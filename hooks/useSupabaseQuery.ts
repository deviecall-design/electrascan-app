/**
 * useSupabaseQuery — tries a Supabase fetch, falls back to mock data.
 *
 * Usage:
 *   const { data, loading, isLive } = useSupabaseQuery(fetchEstimates, MOCK_ESTIMATES);
 *
 *   - `data`    → the array to render (Supabase rows if available, else mock)
 *   - `loading` → true during the initial fetch
 *   - `isLive`  → true if the data came from Supabase (false = mock fallback)
 *
 * This pattern means every screen works immediately with hardcoded data and
 * "lights up" the moment the Supabase tables exist + auth is wired.
 */

import { useState, useEffect } from "react";

interface SupabaseResult<T> {
  data: T[] | null;
  error: any;
}

interface QueryState<T> {
  data: T[];
  loading: boolean;
  isLive: boolean;
}

export default function useSupabaseQuery<T>(
  fetcher: () => Promise<SupabaseResult<T>>,
  fallback: T[],
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: fallback,
    loading: true,
    isLive: false,
  });

  useEffect(() => {
    let cancelled = false;

    fetcher()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          setState({ data: fallback, loading: false, isLive: false });
        } else {
          setState({ data, loading: false, isLive: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ data: fallback, loading: false, isLive: false });
        }
      });

    return () => { cancelled = true; };
  }, []); // intentional: fetch once on mount

  return state;
}
