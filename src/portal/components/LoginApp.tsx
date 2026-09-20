import { useEffect, useState } from 'react';
import { apiLogout, hydrateLiveStore } from '../lib/store';

type Step = 'credentials' | 'otp' | 'forgot';

export default function LoginApp() {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const store = await hydrateLiveStore();
      if (store?.session) {
        window.location.href = store.session.role === 'admin' ? '/portal/admin' : '/portal/client';
      }
    })();
  }, []);

  async function startLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign in failed');
        return;
      }
      setInfo(
        data.mailSent
          ? `A one-time code was emailed to ${data.email}.`
          : 'Could not send the email code. Check Mailgun configuration or try again.'
      );
      setStep('otp');
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/portal/auth/verify-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verification failed');
        return;
      }
      await hydrateLiveStore();
      window.location.href = data.session.role === 'admin' ? '/portal/admin' : '/portal/client';
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const res = await fetch('/api/portal/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not request reset');
        return;
      }
      setInfo(data.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="portal-top">
        <div className="portal-top-in">
          <a className="portal-brand" href="/">
            <span>
              Tax for Taxi Drivers
              <small>Client portal</small>
            </span>
          </a>
          <nav className="portal-nav">
            <a href="/">Back to site</a>
          </nav>
        </div>
      </header>

      <main className="portal-main">
        <div className="portal-grid-2">
          <section className="portal-card">
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>Sign in</h1>
            <p className="portal-muted" style={{ marginBottom: 20 }}>
              Sign in with your email and password, then enter the one-time code emailed to you.
            </p>

            {error && <div className="portal-alert portal-alert-error">{error}</div>}
            {info && <div className="portal-alert portal-alert-info">{info}</div>}

            {step === 'forgot' ? (
              <form className="portal-form" onSubmit={requestReset}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <button className="btn btn-y" type="submit" disabled={busy}>
                  Send reset link
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setStep('credentials')}>
                  Back to sign in
                </button>
              </form>
            ) : step === 'credentials' ? (
              <form className="portal-form" onSubmit={startLogin}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button className="btn btn-y" type="submit" disabled={busy}>
                  Continue
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setStep('forgot')}>
                  Forgot password?
                </button>
              </form>
            ) : (
              <form className="portal-form" onSubmit={verifyOtp}>
                <div className="field">
                  <label htmlFor="otp">Six-digit code</label>
                  <div className="otp-box">
                    <input
                      id="otp"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                    />
                    <button className="btn btn-y" type="submit" disabled={busy}>
                      Verify &amp; enter
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={async () => {
                    await apiLogout();
                    setStep('credentials');
                    setOtp('');
                  }}
                >
                  Back
                </button>
              </form>
            )}
          </section>

          <aside className="portal-card">
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Need an account?</h2>
            <p className="portal-muted">
              Driver and staff accounts are created by an administrator. If you need access, ring the office on{' '}
              <strong>02890 132083</strong> or email{' '}
              <a href="mailto:info@taxfortaxidrivers.co.uk">info@taxfortaxidrivers.co.uk</a>.
            </p>
          </aside>
        </div>
      </main>
    </>
  );
}
