/**
 * variationComparison.ts — Logic for comparing two estimates (variations).
 *
 * Takes two EstimateRows with their detected_items, matches components,
 * and calculates deltas (added, removed, quantity changes, cost impact).
 */

import { EstimateRow, ScanRow } from "./supabaseData";

export interface LineItemCompare {
  id: string;
  symbol: string;
  description: string;
  qtyV1: number;
  qtyV2: number;
  qtyDelta: number;
  costV1: number;
  costV2: number;
  costDelta: number;
  status: "unchanged" | "quantity_changed" | "new" | "removed";
}

export interface VariationDelta {
  itemsAdded: LineItemCompare[];
  itemsRemoved: LineItemCompare[];
  itemsChanged: LineItemCompare[];
  itemsUnchanged: LineItemCompare[];
  
  totalCostV1: number;
  totalCostV2: number;
  totalDelta: number;
  
  qtyAddedTotal: number;
  qtyRemovedTotal: number;
}

/**
 * Normalize a line item description for comparison.
 * "Double power outlet" → "double power outlet"
 * Removes extra spaces, converts to lowercase.
 */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Calculate simple string distance (Levenshtein-lite) for fuzzy matching.
 * Used to match "LED downlight v1" to "LED downlight" across revisions.
 * Returns 0–1 where 1 = perfect match.
 */
function calculateSimilarity(a: string, b: string): number {
  const norm_a = normalizeDescription(a);
  const norm_b = normalizeDescription(b);
  
  if (norm_a === norm_b) return 1;
  if (!norm_a || !norm_b) return 0;
  
  // Simple overlap-based similarity (good enough for electrical component names)
  const words_a = new Set(norm_a.split(" "));
  const words_b = new Set(norm_b.split(" "));
  
  let overlap = 0;
  words_a.forEach(w => {
    if (words_b.has(w)) overlap++;
  });
  
  const union = new Set([...words_a, ...words_b]).size;
  return union > 0 ? overlap / union : 0;
}

/**
 * Compare two estimates and return a structured delta.
 *
 * Algorithm:
 * 1. For each item in v2, find best match in v1 (by symbol + description similarity)
 * 2. If match found: check if quantity changed
 * 3. If no match: mark as "new"
 * 4. Remaining v1 items = "removed"
 */
export function compareEstimates(
  v1: EstimateRow,
  v2: EstimateRow,
): VariationDelta {
  const items1 = v1.line_items || [];
  const items2 = v2.line_items || [];
  
  const matched = new Set<number>();
  const deltas: LineItemCompare[] = [];
  
  // Match v2 items to v1
  items2.forEach((item2, idx2) => {
    let bestMatch = -1;
    let bestScore = 0.3; // Minimum threshold
    
    items1.forEach((item1, idx1) => {
      if (matched.has(idx1)) return; // Already matched
      
      // Weight symbol match heavily, then description
      const symbolMatch = item1.symbol === item2.symbol ? 1 : 0;
      const descSimilarity = calculateSimilarity(item1.description, item2.description);
      const combinedScore = symbolMatch * 0.6 + descSimilarity * 0.4;
      
      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestMatch = idx1;
      }
    });
    
    if (bestMatch >= 0) {
      // Matched to v1 item
      const item1 = items1[bestMatch];
      matched.add(bestMatch);
      
      const costV1 = (item1.material_cost || 0) + (item1.labour_cost || 0);
      const costV2 = (item2.material_cost || 0) + (item2.labour_cost || 0);
      const qtyDelta = item2.quantity - item1.quantity;
      const costDelta = costV2 * item2.quantity - costV1 * item1.quantity;
      
      deltas.push({
        id: item2.rate_code || `line-${idx2}`,
        symbol: item2.symbol,
        description: item2.description,
        qtyV1: item1.quantity,
        qtyV2: item2.quantity,
        qtyDelta,
        costV1: costV1 * item1.quantity,
        costV2: costV2 * item2.quantity,
        costDelta,
        status: qtyDelta === 0 ? "unchanged" : "quantity_changed",
      });
    } else {
      // New item in v2
      const costV2 = (item2.material_cost || 0) + (item2.labour_cost || 0);
      deltas.push({
        id: item2.rate_code || `line-${idx2}`,
        symbol: item2.symbol,
        description: item2.description,
        qtyV1: 0,
        qtyV2: item2.quantity,
        qtyDelta: item2.quantity,
        costV1: 0,
        costV2: costV2 * item2.quantity,
        costDelta: costV2 * item2.quantity,
        status: "new",
      });
    }
  });
  
  // Remaining v1 items = removed
  items1.forEach((item1, idx1) => {
    if (matched.has(idx1)) return;
    
    const costV1 = (item1.material_cost || 0) + (item1.labour_cost || 0);
    deltas.push({
      id: item1.rate_code || `line-${idx1}`,
      symbol: item1.symbol,
      description: item1.description,
      qtyV1: item1.quantity,
      qtyV2: 0,
      qtyDelta: -item1.quantity,
      costV1: costV1 * item1.quantity,
      costV2: 0,
      costDelta: -(costV1 * item1.quantity),
      status: "removed",
    });
  });
  
  // Categorize deltas
  const itemsAdded = deltas.filter(d => d.status === "new");
  const itemsRemoved = deltas.filter(d => d.status === "removed");
  const itemsChanged = deltas.filter(d => d.status === "quantity_changed");
  const itemsUnchanged = deltas.filter(d => d.status === "unchanged");
  
  const totalCostV1 = items1.reduce((sum, i) => sum + (i.total_cost || 0), 0) || v1.value || 0;
  const totalCostV2 = items2.reduce((sum, i) => sum + (i.total_cost || 0), 0) || v2.value || 0;
  
  return {
    itemsAdded,
    itemsRemoved,
    itemsChanged,
    itemsUnchanged,
    totalCostV1,
    totalCostV2,
    totalDelta: totalCostV2 - totalCostV1,
    qtyAddedTotal: itemsAdded.reduce((sum, i) => sum + i.qtyDelta, 0),
    qtyRemovedTotal: Math.abs(itemsRemoved.reduce((sum, i) => sum + i.qtyDelta, 0)),
  };
}
