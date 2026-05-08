import { describe, it, expect } from 'vitest';
import { incrementEstimateNumber, getActiveCompanyProfile, VESH_PROFILE } from '../services/companyProfile';

describe('incrementEstimateNumber', () => {
  it('increments a standard revision suffix', () => {
    expect(incrementEstimateNumber('EST-2026-497-001')).toBe('EST-2026-497-002');
  });

  it('rolls over double digits', () => {
    expect(incrementEstimateNumber('EST-2026-497-009')).toBe('EST-2026-497-010');
  });

  it('preserves zero-padding width', () => {
    expect(incrementEstimateNumber('EST-2026-497-099')).toBe('EST-2026-497-100');
  });

  it('adds -002 when no suffix exists', () => {
    expect(incrementEstimateNumber('EST-2026-497')).toBe('EST-2026-497-002');
  });

  it('treats a zero-padded trailing group as a revision suffix', () => {
    // EST-001: "001" starts with 0 → treated as rev suffix → increments to EST-002
    // (Real refs follow EST-YYYY-NNN-REV format; this is consistent behaviour)
    expect(incrementEstimateNumber('EST-001')).toBe('EST-002');
  });
});

describe('getActiveCompanyProfile', () => {
  it('returns a profile with required fields', () => {
    const profile = getActiveCompanyProfile();
    expect(profile.name).toBeTruthy();
    expect(profile.abn).toBeTruthy();
    expect(profile.email).toBeTruthy();
  });

  it('returns Vesh profile in single-tenant phase', () => {
    const profile = getActiveCompanyProfile();
    expect(profile.id).toBe(VESH_PROFILE.id);
  });

  it('has a valid defaultMargin', () => {
    const profile = getActiveCompanyProfile();
    expect(profile.defaultMargin).toBeGreaterThan(0);
    expect(profile.defaultMargin).toBeLessThan(100);
  });
});
