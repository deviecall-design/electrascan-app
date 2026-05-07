import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useSupabaseQuery from '../hooks/useSupabaseQuery';

const MOCK_FALLBACK = [{ id: 'mock-1', name: 'Mock Item' }];

describe('useSupabaseQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with fallback data and loading=true', () => {
    const fetcher = vi.fn(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSupabaseQuery(fetcher, MOCK_FALLBACK));
    expect(result.current.data).toEqual(MOCK_FALLBACK);
    expect(result.current.loading).toBe(true);
    expect(result.current.isLive).toBe(false);
  });

  it('transitions to live data on successful fetch', async () => {
    const liveData = [{ id: 'live-1', name: 'Live Item' }];
    const fetcher = vi.fn().mockResolvedValue({ data: liveData, error: null });

    const { result } = renderHook(() => useSupabaseQuery(fetcher, MOCK_FALLBACK));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(liveData);
    expect(result.current.isLive).toBe(true);
  });

  it('falls back to mock data when Supabase returns an error', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: null, error: { message: 'table not found' } });

    const { result } = renderHook(() => useSupabaseQuery(fetcher, MOCK_FALLBACK));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(MOCK_FALLBACK);
    expect(result.current.isLive).toBe(false);
  });

  it('falls back when data is null', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useSupabaseQuery(fetcher, MOCK_FALLBACK));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(MOCK_FALLBACK);
    expect(result.current.isLive).toBe(false);
  });

  it('does NOT fall back on an empty array — empty live result is valid', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useSupabaseQuery(fetcher, MOCK_FALLBACK));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
    expect(result.current.isLive).toBe(true);
  });

  it('falls back gracefully when fetcher throws', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useSupabaseQuery(fetcher, MOCK_FALLBACK));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(MOCK_FALLBACK);
    expect(result.current.isLive).toBe(false);
  });

  it('calls the fetcher exactly once on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: [], error: null });

    renderHook(() => useSupabaseQuery(fetcher, MOCK_FALLBACK));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  });
});
