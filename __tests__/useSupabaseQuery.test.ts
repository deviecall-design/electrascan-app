import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useSupabaseQuery from '../hooks/useSupabaseQuery';

const MOCK_FALLBACK = [{ id: 'mock-1', name: 'Mock Item' }];

describe('useSupabaseQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts empty while loading — never paints sample jobs as the pipeline', () => {
    const fetcher = vi.fn(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSupabaseQuery(fetcher, MOCK_FALLBACK));
    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.isLive).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it('transitions to live data on successful fetch', async () => {
    const liveData = [{ id: 'live-1', name: 'Live Item' }];
    const fetcher = vi.fn().mockResolvedValue({ data: liveData, error: null });

    const { result } = renderHook(() => useSupabaseQuery(fetcher, MOCK_FALLBACK));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(liveData);
    expect(result.current.isLive).toBe(true);
    expect(result.current.error).toBe(false);
  });

  it('uses fallback only after an error, not during loading', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: null, error: { message: 'table not found' } });

    const { result } = renderHook(() => useSupabaseQuery(fetcher, MOCK_FALLBACK));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(MOCK_FALLBACK);
    expect(result.current.isLive).toBe(false);
    expect(result.current.error).toBe(true);
  });

  it('stays empty on error when no fallback is passed (Dashboard path)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: null, error: { message: 'table not found' } });

    const { result } = renderHook(() => useSupabaseQuery(fetcher));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe(true);
    expect(result.current.isLive).toBe(false);
  });

  it('does NOT treat an empty array as an error — empty live result is valid', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useSupabaseQuery(fetcher, MOCK_FALLBACK));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
    expect(result.current.isLive).toBe(true);
    expect(result.current.error).toBe(false);
  });

  it('marks error when the fetcher throws, without showing fallback if omitted', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useSupabaseQuery(fetcher));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe(true);
  });

  it('calls the fetcher exactly once on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: [], error: null });

    renderHook(() => useSupabaseQuery(fetcher));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  });
});
