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

const DEFAULT_TIMEOUT_MS = 12000;

export default function useSupabaseQuery<T>(
  fetcher: () => Promise<SupabaseResult<T>>,
  fallback?: T[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: [],
    loading: true,
    isLive: false,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    let timer = 0;
    const finish = (next: QueryState<T>) => {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(timer);
      setState(next);
    };

    timer = window.setTimeout(() => {
      finish({
        data: fallback ?? [],
        loading: false,
        isLive: false,
        error: true,
      });
    }, timeoutMs);

    fetcher()
      .then(({ data, error }) => {
        if (error || !data) {
          finish({
            data: fallback ?? [],
            loading: false,
            isLive: false,
            error: true,
          });
        } else {
          finish({ data, loading: false, isLive: true, error: false });
        }
      })
      .catch(() => {
        finish({
          data: fallback ?? [],
          loading: false,
          isLive: false,
          error: true,
        });
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []); // intentional: fetch once on mount

  return state;
}
