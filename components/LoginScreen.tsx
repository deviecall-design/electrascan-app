import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

const C = {
  bg: '#0A1628', navy: '#0F1E35', card: '#132240',
  blue: '#1D6EFD', blueLt: '#4B8FFF', green: '#00C48C',
  amber: '#FFB020', red: '#FF4D4D', text: '#EDF2FF',
  muted: '#5C7A9E', border: '#1A3358', dim: '#8BA4C4',
};

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter email and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) setError(signInError);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: C.bg, border: `1px solid ${C.border}`,
    color: C.text, fontSize: 14, padding: '12px 14px', borderRadius: 10,
    outline: 'none', marginTop: 6,
  };

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 18,
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: C.card,
        border: `1px solid ${C.border}`, borderRadius: 16, padding: 24,
      }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.blue, letterSpacing: '-0.03em' }}>
            Electra<span style={{ color: C.text }}>Scan</span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Sign in to continue
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={submitting}
              style={inputStyle}
              placeholder="you@company.com"
            />
          </label>

          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={submitting}
              style={inputStyle}
            />
          </label>

          {error && (
            <div style={{
              background: `${C.red}18`, border: `1px solid ${C.red}44`,
              color: C.red, fontSize: 12, padding: '10px 12px',
              borderRadius: 10, marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', background: C.blue, border: 'none', color: '#fff',
              fontSize: 14, fontWeight: 700, padding: '12px', borderRadius: 12,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
