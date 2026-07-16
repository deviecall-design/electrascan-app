import type { EstimateLineItem } from '../contexts/ProjectContext';
import { fetchLibraryBySupplier } from './rateLibraryService';

export type TleMatchStatus = 'MATCHED' | 'REVIEW' | 'SOURCE_ELSEWHERE' | 'NOT_IN_CATALOGUE';

export interface TleProduct {
  sku: string;
  name: string;
  brand: string;
  category: string;
  url: string;
}

export interface TleMatchResult {
  item: EstimateLineItem;
  status: TleMatchStatus;
  confidence: number; // 0–100
  note: string;
  matches: Array<TleProduct & { matchScore: number }>;
}

export interface TleBomResult {
  generated: string;
  catalogueSize: number;
  items: TleMatchResult[];
  summary: {
    total: number;
    matched: number;
    review: number;
    sourceElsewhere: number;
    notInCatalogue: number;
  };
}

// Brands definitively not stocked at TLE
const NOT_AT_TLE_BRANDS = ['zetr', 'zetec', 'zetron'];

const STOPWORDS = new Set([
  'a','an','the','and','or','for','with','of','in','to','from','by','at',
  'on','as','is','are','was','mm','cm','m','v','w','hz','ip','dc','ac',
  'volt','watt','amp','series','type','model','pair',
]);

function tokenise(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function fuzzyScore(queryTokens: string[], productName: string, productBrand: string): number {
  const prodTokens = new Set(tokenise(productName + ' ' + productBrand));
  let hits = 0;
  for (const qt of queryTokens) {
    if (prodTokens.has(qt)) {
      hits += 1;
    } else if ([...prodTokens].some(pt => pt.startsWith(qt) || qt.startsWith(pt))) {
      hits += 0.5;
    }
  }
  const precision = hits / (queryTokens.length || 1);
  const recall = hits / (prodTokens.size || 1);
  return (2 * precision * recall) / (precision + recall + 0.001);
}

let catalogueCache: TleProduct[] | null = null;

async function loadCatalogue(): Promise<TleProduct[]> {
  if (catalogueCache) return catalogueCache;
  const res = await fetch('/tle-catalog.json');
  catalogueCache = await res.json();
  return catalogueCache!;
}

const HIGH_THRESHOLD = 0.25;
const MEDIUM_THRESHOLD = 0.12;

// Try supplier-tagged library first (Option 3). Falls back to fuzzy catalogue match (Option 2).
export async function matchEstimateToTle(items: EstimateLineItem[]): Promise<TleBomResult> {
  // If rate library has tagged items, use exact supplier match — no fuzzy needed
  const libraryResult = await fetchLibraryBySupplier('TLE');
  const taggedByDesc = new Map(
    libraryResult.ok
      ? libraryResult.items.map(li => [li.name.toLowerCase(), li])
      : []
  );

  const catalogue = await loadCatalogue();

  const results: TleMatchResult[] = items.map(item => {
    const descLower = item.description.toLowerCase();

    // Option 3 fast path: exact supplier tag in rate library
    const tagged = taggedByDesc.get(descLower);
    if (tagged) {
      const tleSku = tagged.supplierSkus['TLE'] ?? tagged.code;
      return {
        item,
        status: 'MATCHED',
        confidence: 99,
        note: 'Confirmed TLE supplier tag',
        matches: [{ sku: tleSku, name: tagged.name, brand: tagged.brand, category: tagged.category, url: `https://tle.mmem.com.au/${tleSku.toLowerCase()}`, matchScore: 99 }],
      };
    }

    // Known non-TLE brand → source elsewhere
    if (NOT_AT_TLE_BRANDS.some(b => descLower.includes(b))) {
      return {
        item,
        status: 'SOURCE_ELSEWHERE',
        confidence: 0,
        note: 'Brand not stocked at TLE — source from specialist supplier',
        matches: [],
      };
    }

    const queryTokens = tokenise(item.description);

    const scored = catalogue
      .map(prod => ({ ...prod, matchScore: fuzzyScore(queryTokens, prod.name, prod.brand) }))
      .filter(p => p.matchScore > 0.05)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3)
      .map(p => ({ ...p, matchScore: Math.round(p.matchScore * 100) }));

    const best = scored[0]?.matchScore ?? 0;

    let status: TleMatchStatus;
    let note: string;

    if (best >= HIGH_THRESHOLD * 100) {
      status = 'MATCHED';
      note = 'High confidence match — confirm SKU before ordering';
    } else if (best >= MEDIUM_THRESHOLD * 100) {
      status = 'REVIEW';
      note = 'Low confidence — confirm with TLE before ordering';
    } else {
      status = 'NOT_IN_CATALOGUE';
      note = 'Not found in catalogue — check TLE directly';
    }

    return { item, status, confidence: Math.min(best, 95), note, matches: scored };
  });

  const summary = {
    total: results.length,
    matched: results.filter(r => r.status === 'MATCHED').length,
    review: results.filter(r => r.status === 'REVIEW').length,
    sourceElsewhere: results.filter(r => r.status === 'SOURCE_ELSEWHERE').length,
    notInCatalogue: results.filter(r => r.status === 'NOT_IN_CATALOGUE').length,
  };

  return {
    generated: new Date().toISOString(),
    catalogueSize: catalogue.length,
    items: results,
    summary,
  };
}

// Returns only the items TLE can supply (MATCHED + REVIEW), with top SKU attached
export async function buildTleBom(
  items: EstimateLineItem[],
  unitPrices: Record<string, number>,
): Promise<Array<{ description: string; category: string; qty: number; unit_price: number; line_total: number; tle_sku: string; tle_product: string; match_status: TleMatchStatus; confidence: number }>> {
  const result = await matchEstimateToTle(items);

  return result.items
    .filter(r => r.status === 'MATCHED' || r.status === 'REVIEW')
    .map(r => {
      const top = r.matches[0];
      const unit_price = unitPrices[r.item.id] ?? r.item.unitPrice ?? 0;
      return {
        description: r.item.description,
        category: r.item.category,
        qty: r.item.qty,
        unit_price,
        line_total: r.item.qty * unit_price,
        tle_sku: top?.sku ?? '',
        tle_product: top?.name ?? '',
        match_status: r.status,
        confidence: r.confidence,
      };
    });
}
