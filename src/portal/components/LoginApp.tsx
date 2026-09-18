import { useEffect, useState } from 'react';
import { DEMO_PASSWORD, loadStore, saveStore, updateStore } from '../lib/store';
import { demoOtp } from '../lib/calc';

type Step = 'credentials' | 'otp';

export default function LoginApp() {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [pendingCode, setPendingCode] = useState('');

  useEffect(() => {
    const store = loadStore();
    if (store.session && !store.session.pending2fa) {
      window.location.href = store.session.role === 'admin' ? '/portal/admin' : '/portal/client';
    } else if (store.session?.pending2fa) {
      setStep('otp');
      setPendingCode(store.session.demoOtp || '');
      setEmail(store.session.email);
    }
  }, []);

  function fill(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError('');
  }

  function startLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const store = loadStore();
    const user = store.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.password !== password) {
      setError('Email or password not recognised. Use a demo account below.');
      return;
    }
    const code = demoOtp();
    store.session = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tradeType: user.tradeType,
      pending2fa: true,
      demoOtp: code,
    };
    store.notices.unshift({
      id: `notice_${Date.now()}`,
      at: new Date().toISOString(),
      to: user.email,
      subject: 'Your login code',
      body: `Demo email OTP: ${code}`,
    });
    saveStore(store);
    setPendingCode(code);
    setStep('otp');
  }

  function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const store = loadStore();
    if (!store.session?.pending2fa || !store.session.demoOtp) {
      setError('Session expired. Sign in again.');
      setStep('credentials');
      return;
    }
    if (otp.trim() !== store.session.demoOtp) {
      setError('That code is incorrect. Use the demo code shown above.');
      return;
    }
    updateStore((s) => {
      if (s.session) {
        s.session.pending2fa = false;
        delete s.session.demoOtp;
      }
    });
    const role = store.session.role;
    window.location.href = role === 'admin' ? '/portal/admin' : '/portal/client';
  }

  return (
    <>
      <header className="portal-top">
        <div className="portal-top-in">
          <a className="portal-brand" href="/">
            <span>
              Tax for Taxi Drivers
              <small>Client portal demo</small>
            </span>
          </a>
          <span className="portal-demo-pill">Static demo · no live integrations</span>
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
              Demo login with email + one-time code (MailGun / Supabase Auth will replace this after approval).
            </p>

            {error && <div className="portal-alert portal-alert-error">{error}</div>}

            {step === 'credentials' ? (
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
                <button className="btn btn-y" type="submit">
                  Continue
                </button>
              </form>
            ) : (
              <form className="portal-form" onSubmit={verifyOtp}>
                <div className="portal-alert portal-info portal-alert-info">
                  <strong>Demo email sent</strong> to {email}. For this static build the code is shown here instead of MailGun:
                  <div style={{ fontSize: 28, letterSpacing: '0.2em', fontWeight: 800, marginTop: 8 }}>{pendingCode}</div>
                </div>
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
                    <button className="btn btn-y" type="submit">
                      Verify &amp; enter
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    updateStore((s) => {
                      s.session = null;
                    });
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
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Demo accounts</h2>
            <p className="portal-muted">Password for all accounts: <strong>{DEMO_PASSWORD}</strong></p>
            <div className="demo-accounts">
              <button type="button" onClick={() => fill('admin@taxfortaxidrivers.co.uk')}>
                <strong>Admin - Michael</strong>
                <span>admin@taxfortaxidrivers.co.uk · full contacts &amp; bulk email</span>
              </button>
              <button type="button" onClick={() => fill('james.driver@example.com')}>
                <strong>Client - James (taxi)</strong>
                <span>james.driver@example.com · ready-to-sign submission seeded</span>
              </button>
              <button type="button" onClick={() => fill('sara.beauty@example.com')}>
                <strong>Client - Sara (beautician)</strong>
                <span>sara.beauty@example.com · draft with beautician categories</span>
              </button>
            </div>
            <p className="portal-muted" style={{ marginTop: 18, fontSize: 13 }}>
              Spreadsheet categories match the client’s taxi &amp; beautician MTD workbooks in <code>reference/portal-brief/</code>.
            </p>
          </aside>
        </div>
      </main>
    </>
  );
}
