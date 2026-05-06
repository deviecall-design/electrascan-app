import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const C = {
  bg: '#0A1628', navy: '#0F1E35', card: '#132240',
  blue: '#1D6EFD', text: '#EDF2FF', muted: '#5C7A9E',
  border: '#1A3358', red: '#FF4D4D',
};

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      setLoading(false);
    }
    // On success, AuthContext updates session → App re-renders with app content
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
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 40 }}>Sign in to your workspace</div>

      {/* Card */}
      <form onSubmit={handleSubmit} style={{
        background: C.navy, border: `1px solid ${C.border}`,
        borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 380,
      }}>
        {/* Email */}
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

        {/* Password */}
        <div style={{ marginBottom: 24 }}>
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

        {/* Submit */}
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
            <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #ffffff55', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Signing in...</>
          ) : 'Sign in'}
        </button>
      </form>

      {/* Spin keyframe is already declared in App.tsx CSS */}
    </div>
  );
}
