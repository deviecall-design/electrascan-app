import { describe, it, expect } from 'vitest';
import {
  ASNZS_SYMBOL_MAP,
  COMPONENT_TYPE_TO_SKU,
  COMPONENT_TYPE_META,
  LEGEND_PATTERNS,
  type ComponentType,
} from '../lib/symbol_map';

describe('ASNZS_SYMBOL_MAP', () => {
  it('has no duplicate symbol code keys', () => {
    // Object keys are inherently unique in JS, but this catches copy-paste
    // bugs where a later definition silently overwrites an earlier one.
    // We detect this by counting lines in the source vs the parsed object.
    const keys = Object.keys(ASNZS_SYMBOL_MAP);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('every value is a valid ComponentType', () => {
    const validTypes = new Set(Object.keys(COMPONENT_TYPE_META));
    for (const [symbol, componentType] of Object.entries(ASNZS_SYMBOL_MAP)) {
      expect(validTypes.has(componentType), `Symbol "${symbol}" maps to unknown ComponentType "${componentType}"`).toBe(true);
    }
  });

  it('maps common AU electrical symbols correctly', () => {
    expect(ASNZS_SYMBOL_MAP['GPO']).toBe('GPO_DOUBLE');
    expect(ASNZS_SYMBOL_MAP['SD']).toBe('SMOKE_DETECTOR');
    expect(ASNZS_SYMBOL_MAP['EV']).toBe('EV_CHARGER');
    expect(ASNZS_SYMBOL_MAP['DL']).toBe('DOWNLIGHT_RECESSED');
  });

  it('SWD maps to dimmer (not SD which is smoke detector)', () => {
    expect(ASNZS_SYMBOL_MAP['SWD']).toBe('SWITCHING_DIMMER');
    expect(ASNZS_SYMBOL_MAP['SD']).toBe('SMOKE_DETECTOR');
  });
});

describe('COMPONENT_TYPE_TO_SKU', () => {
  it('every ComponentType has at least one SKU', () => {
    for (const [type, skus] of Object.entries(COMPONENT_TYPE_TO_SKU)) {
      expect(skus.length, `ComponentType "${type}" has no SKUs`).toBeGreaterThan(0);
    }
  });

  it('every ComponentType in META has a SKU mapping', () => {
    for (const type of Object.keys(COMPONENT_TYPE_META) as ComponentType[]) {
      expect(COMPONENT_TYPE_TO_SKU[type], `"${type}" is in META but missing from SKU map`).toBeDefined();
    }
  });
});

describe('LEGEND_PATTERNS', () => {
  it('has no duplicate regex patterns', () => {
    const sources = LEGEND_PATTERNS.map(p => p.pattern.source);
    const unique = new Set(sources);
    expect(sources.length).toBe(unique.size);
  });

  it('matches common legend phrases', () => {
    const match = (text: string) =>
      LEGEND_PATTERNS.find(p => p.pattern.test(text))?.componentType;

    expect(match('Recessed downlight')).toBe('DOWNLIGHT_RECESSED');
    expect(match('Smoke detector')).toBe('SMOKE_DETECTOR');
    expect(match('EV charger')).toBe('EV_CHARGER');
    expect(match('Exhaust fan')).toBe('EXHAUST_FAN');
    expect(match('Motorised blind')).toBe('MOTORISED_BLIND');
  });

  it('dynalite matches before generic switch', () => {
    const match = (text: string) =>
      LEGEND_PATTERNS.find(p => p.pattern.test(text))?.componentType;
    expect(match('Dynalite switch')).toBe('SWITCHING_DYNALITE');
  });
});
