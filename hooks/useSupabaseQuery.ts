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
  errorMessage: string | null;
}

const DEFAULT_TIMEOUT_MS = 12000;

function failureMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : null;
  }
  return null;
}

export default function useSupabaseQuery<T>(
  fetcher: () => Promise<SupabaseResult<T>>,
  fallback?: T[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): QueryState<T> & { reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<QueryState<T>>({
    data: [],
    loading: true,
    isLive: false,
    error: false,
    errorMessage: null,
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
        errorMessage: "This took too long to load.",
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
            errorMessage: failureMessage(error),
          });
        } else {
          finish({ data, loading: false, isLive: true, error: false, errorMessage: null });
        }
      })
      .catch((err: unknown) => {
        finish({
          data: fallback ?? [],
          loading: false,
          isLive: false,
          error: true,
          errorMessage: failureMessage(err),
        });
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [attempt]); // refetch only when reload() bumps the attempt

  const reload = () => {
    setState(prev => ({
      ...prev,
      loading: true,
      error: false,
      errorMessage: null,
    }));
    setAttempt(n => n + 1);
  };

  return { ...state, reload };
}
