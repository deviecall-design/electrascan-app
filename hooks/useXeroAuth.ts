import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export type XeroConnectionStatus = 'loading' | 'connected' | 'disconnected' | 'error';

export interface XeroToken {
  id: string;
  org_id: string;
  xero_tenant_id: string;
  xero_tenant_name: string | null;
  token_expiry: string;
  updated_at: string;
}

export interface UseXeroAuthReturn {
  status: XeroConnectionStatus;
  /** The active token row for this org, null when not connected. */
  token: XeroToken | null;
  /** True when the access_token has expired and a server-side refresh is needed. */
  isExpired: boolean;
  /** Redirect the browser to /api/xero/auth to begin the OAuth flow. */
  connect: () => void;
  /** Remove the stored token row from Supabase (revokes the local connection record). */
  disconnect: () => Promise<void>;
  /** Re-query Supabase for the latest token state. */
  refresh: () => Promise<void>;
  error: string | null;
}

export function useXeroAuth(): UseXeroAuthReturn {
  const { user } = useAuth();
  const [status, setStatus] = useState<XeroConnectionStatus>('loading');
  const [token, setToken] = useState<XeroToken | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    if (!user) {
      setStatus('disconnected');
      setToken(null);
      return;
    }

    setStatus('loading');
    setError(null);

    // Fetch the most recently updated token row for this user.
    // Most orgs will have exactly one row; we take the freshest.
    const { data, error: dbErr } = await supabase
      .from('xero_tokens')
      .select('id, org_id, xero_tenant_id, xero_tenant_name, token_expiry, updated_at')
      .eq('org_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbErr) {
      setStatus('error');
      setError(dbErr.message);
      setToken(null);
      return;
    }

    if (!data) {
      setStatus('disconnected');
      setToken(null);
      return;
    }

    setToken(data as XeroToken);
    setStatus('connected');
  }, [user]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Redirect to the server-side auth initiator. org_id is passed so the
  // callback can associate the returned tokens with this user's row.
  const connect = useCallback(() => {
    if (!user) return;
    const url = `/api/xero/auth?org_id=${encodeURIComponent(user.id)}`;
    window.location.href = url;
  }, [user]);

  const disconnect = useCallback(async () => {
    if (!user || !token) return;
    setError(null);

    const { error: dbErr } = await supabase
      .from('xero_tokens')
      .delete()
      .eq('org_id', user.id);

    if (dbErr) {
      setError(dbErr.message);
      return;
    }

    setToken(null);
    setStatus('disconnected');
  }, [user, token]);

  // True when there is a token but the access_token window has passed.
  // The app should call a server-side refresh endpoint before making Xero API calls.
  const isExpired = token != null && new Date(token.token_expiry) <= new Date();

  return {
    status,
    token,
    isExpired,
    connect,
    disconnect,
    refresh: fetchToken,
    error,
  };
}
