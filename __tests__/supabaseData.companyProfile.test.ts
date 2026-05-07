import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() ensures these are available when vi.mock() factory runs
const { mockSingle, mockMaybeSingle, mockUpsert, mockFrom, mockGetUser } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockUpsert = vi.fn(() => ({ select: () => ({ single: mockSingle }) }));
  const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle, single: mockSingle }));
  const mockFrom = vi.fn(() => ({ select: mockSelect, upsert: mockUpsert }));
  const mockGetUser = vi.fn();
  return { mockSingle, mockMaybeSingle, mockUpsert, mockFrom, mockGetUser };
});

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    auth: { getUser: mockGetUser },
  },
}));

import { fetchCompanyProfile, upsertCompanyProfile } from '../services/supabaseData';

describe('fetchCompanyProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null data for a fresh tenant with no profile row', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { data, error } = await fetchCompanyProfile();
    expect(data).toBeNull();
    expect(error).toBeNull();
  });

  it('returns a profile row when one exists', async () => {
    const profile = { id: 'abc', name: 'Test Electrical', abn: '12 345 678 901' };
    mockMaybeSingle.mockResolvedValue({ data: profile, error: null });

    const { data } = await fetchCompanyProfile();
    expect(data).toEqual(profile);
  });

  it('propagates Supabase errors', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    const { error } = await fetchCompanyProfile();
    expect(error?.message).toBe('permission denied');
  });
});

describe('upsertCompanyProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes owner_id from auth when user is signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } });
    mockSingle.mockResolvedValue({ data: { id: 'row-1' }, error: null });

    await upsertCompanyProfile({ name: 'Test Electrical', abn: '12 345 678 901' } as any);

    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({ owner_id: 'user-uuid-123', name: 'Test Electrical' })],
      { onConflict: 'owner_id' },
    );
  });

  it('omits owner_id when no user session exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockSingle.mockResolvedValue({ data: { id: 'row-1' }, error: null });

    await upsertCompanyProfile({ name: 'Test Electrical', abn: '12 345 678 901' } as any);

    const [rows] = mockUpsert.mock.calls[0];
    expect(rows[0]).not.toHaveProperty('owner_id');
    expect(rows[0].name).toBe('Test Electrical');
  });

  it('returns the upserted row on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } });
    const returned = { id: 'row-1', name: 'Test Electrical' };
    mockSingle.mockResolvedValue({ data: returned, error: null });

    const { data } = await upsertCompanyProfile({ name: 'Test Electrical' } as any);
    expect(data).toEqual(returned);
  });
});
