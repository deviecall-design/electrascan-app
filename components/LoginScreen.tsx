import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

const C = {
  bg: '#0A1628', navy: '#0F1E35', card: '#132240',
  blue: '#1D6EFD', text: '#EDF2FF', muted: '#5C7A9E',
  border: '#1A3358', red: '#FF4D4D', green: '#10B981',
};

type Mode = 'signin' | 'reset';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setResetSent(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Enter your email address above.'); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
  };

  return (
    <div style={{
      height: '100vh', background: C.bg, display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 8, fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>
        <span style={{ color: C.blue }}>Electra</span>
        <span style={{ color: C.text }}>Scan</span>
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 40 }}>
        {mode === 'signin' ? 'Sign in to your workspace' : 'Reset your password'}
      </div>

      {/* Card */}
      <form
        onSubmit={mode === 'signin' ? handleSignIn : handleReset}
        style={{
          background: C.navy, border: `1px solid ${C.border}`,
          borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 380,
        }}
      >
        {/* Email — shown in both modes */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Email
          </label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              width: '100%', background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '12px 14px', fontSize: 14,
              color: C.text, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Password — sign-in only */}
        {mode === 'signin' && (
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '12px 14px', fontSize: 14,
                color: C.text, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Forgot password link */}
        {mode === 'signin' && (
          <div style={{ textAlign: 'right', marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => switchMode('reset')}
              style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              Forgot password?
            </button>
          </div>
        )}

        {/* Reset mode hint */}
        {mode === 'reset' && !resetSent && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20, lineHeight: 1.55 }}>
            We'll send a reset link to that address. Check your inbox — it may take a minute.
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: `${C.red}18`, border: `1px solid ${C.red}55`,
            borderRadius: 8, padding: '10px 12px', marginBottom: 16,
            fontSize: 13, color: C.red,
          }}>
            {error}
          </div>
        )}

        {/* Reset success */}
        {resetSent ? (
          <div style={{
            background: `${C.green}18`, border: `1px solid ${C.green}55`,
            borderRadius: 8, padding: '12px 14px', marginBottom: 16,
            fontSize: 13, color: C.green, lineHeight: 1.55,
          }}>
            Reset link sent to <strong>{email}</strong>. Check your inbox and follow the link to set a new password.
          </div>
        ) : (
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', background: loading ? C.border : C.blue,
              border: 'none', borderRadius: 12, padding: '14px',
              fontSize: 15, fontWeight: 700, color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxSizing: 'border-box',
            }}
          >
            {loading ? (
              <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #ffffff55', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> {mode === 'signin' ? 'Signing in...' : 'Sending...'}</>
            ) : mode === 'signin' ? 'Sign in' : 'Send reset link'}
          </button>
        )}

        {/* Back to sign in */}
        {mode === 'reset' && (
          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              ← Back to sign in
            </button>
          </div>
        )}
      </form>

      {/* Spin keyframe is already declared in App.tsx CSS */}
    </div>
  );
}
