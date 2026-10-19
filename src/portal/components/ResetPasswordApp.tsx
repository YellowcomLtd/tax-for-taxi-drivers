import { useEffect, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createBrowserSupabase } from '../../lib/supabase/browser';

export default function ResetPasswordApp() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const supabase = createBrowserSupabase();
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get('token_hash');
        const type = (params.get('type') || 'recovery') as EmailOtpType;

        if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (cancelled) return;
          if (verifyError) {
            setError(
              verifyError.message ||
                'This password link is invalid or has expired. Ask the office to send a new invite.'
            );
            setReady(true);
            return;
          }
          window.history.replaceState({}, '', '/portal/reset-password');
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!session) {
          setError(
            'This password link is invalid or has expired. Ask the office to send a new invite.'
          );
          setHasSession(false);
        } else {
          setHasSession(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not open password reset.');
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 10) {
      setError('Use at least 10 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/portal/auth/update-password', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update password');
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="portal-top">
        <div className="portal-top-in">
          <a className="portal-brand" href="/portal">
            <span>
              Tax for Taxi Drivers
              <small>Set a new password</small>
            </span>
          </a>
        </div>
      </header>
      <main className="portal-main">
        <section className="portal-card" style={{ maxWidth: 480, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, marginBottom: 12 }}>Choose a new password</h1>
          {!ready ? (
            <p className="portal-muted">Checking reset link…</p>
          ) : done ? (
            <>
              <div className="portal-alert portal-alert-success">Password updated. You can sign in now.</div>
              <a className="btn btn-y" href="/portal">
                Go to sign in
              </a>
            </>
          ) : !hasSession ? (
            <>
              {error && <div className="portal-alert portal-alert-error">{error}</div>}
              <a className="btn btn-ghost" href="/portal">
                Back to sign in
              </a>
            </>
          ) : (
            <form className="portal-form" onSubmit={submit}>
              {error && <div className="portal-alert portal-alert-error">{error}</div>}
              <div className="field">
                <label htmlFor="password">New password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={10}
                />
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={10}
                />
              </div>
              <button className="btn btn-y" type="submit" disabled={busy}>
                Save password
              </button>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
