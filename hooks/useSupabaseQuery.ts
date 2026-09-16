/**
 * useSupabaseQuery — fetch a table, then render live rows or an empty list.
 *
 * Live production walk (15 Sep 2026): Dashboard initialised on Bondi mock
 * rows (EST-2026-0142, Switchboard_LV2_rev3.pdf @ 72%) then swapped to an
 * empty list. The amber chip said “Supabase tables not yet created” while
 * Damien was signed in as Vesh Electrical — tables exist; the account is
 * empty. That flash is worse than a blank pipeline.
 *
 * Contract:
 *   - loading → empty array (never sample jobs)
 *   - success (including []) → isLive true
 *   - error → empty array unless a fallback is passed (rate library only)
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
  error: boolean;
}

export default function useSupabaseQuery<T>(
  fetcher: () => Promise<SupabaseResult<T>>,
  fallback?: T[],
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: [],
    loading: true,
    isLive: false,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;

    fetcher()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setState({
            data: fallback ?? [],
            loading: false,
            isLive: false,
            error: true,
          });
        } else {
          setState({ data, loading: false, isLive: true, error: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            data: fallback ?? [],
            loading: false,
            isLive: false,
            error: true,
          });
        }
      });

    return () => { cancelled = true; };
  }, []); // intentional: fetch once on mount

  return state;
}
