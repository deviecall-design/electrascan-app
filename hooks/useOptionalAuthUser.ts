/**
 * Optional session read for shell chrome.
 *
 * DesktopApp still has no login gate (P0 — separate). This only paints the
 * user chip from an existing Supabase session when one is present. No session
 * → tenant brand, never "Damien C." / "Admin".
 */

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../services/supabaseClient";

export function nameFromAuthUser(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  for (const key of ["full_name", "name", "display_name"] as const) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? null;
  return null;
}

export function firstNameFromDisplay(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean)[0] || name;
}

export default function useOptionalAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return user;
}
