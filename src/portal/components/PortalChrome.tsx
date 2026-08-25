import { useEffect, useState, type ReactNode } from 'react';
import { loadStore, resetStore } from '../lib/store';
import type { Session } from '../lib/types';

interface Props {
  children: ReactNode;
  requireRole?: 'admin' | 'client';
  active?: string;
}

export default function PortalChrome({ children, requireRole, active }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      const store = loadStore();
      const s = store.session;
      if (!s || s.pending2fa) {
        window.location.href = '/portal';
        return;
      }
      if (requireRole && s.role !== requireRole) {
        window.location.href = s.role === 'admin' ? '/portal/admin' : '/portal/client';
        return;
      }
      setSession(s);
      setReady(true);
    };
    sync();
    window.addEventListener('tft-portal-updated', sync);
    return () => window.removeEventListener('tft-portal-updated', sync);
  }, [requireRole]);

  function logout() {
    const store = loadStore();
    store.session = null;
    localStorage.setItem('tft-portal-demo-v2', JSON.stringify(store));
    window.location.href = '/portal';
  }

  function resetDemo() {
    if (confirm('Reset demo data to the seeded example clients and submissions?')) {
      resetStore();
      window.location.href = '/portal';
    }
  }

  if (!ready || !session) {
    return (
      <div className="portal-main">
        <p className="portal-muted">Loading portal…</p>
      </div>
    );
  }

  const links =
    session.role === 'admin'
      ? [
          { href: '/portal/admin', label: 'Dashboard', key: 'admin' },
          { href: '/portal/admin/email', label: 'Bulk email', key: 'email' },
        ]
      : [
          { href: '/portal/client', label: 'My submissions', key: 'client' },
          { href: '/portal/client/new', label: 'New submission', key: 'new' },
        ];

  return (
    <>
      <header className="portal-top">
        <div className="portal-top-in">
          <a className="portal-brand" href={session.role === 'admin' ? '/portal/admin' : '/portal/client'}>
            <span>
              Tax for Taxi Drivers
              <small>Client portal · {session.fullName}</small>
            </span>
          </a>
          <span className="portal-demo-pill">Static demo</span>
          <nav className="portal-nav" aria-label="Portal">
            {links.map((link) => (
              <a key={link.key} href={link.href} aria-current={active === link.key ? 'page' : undefined}>
                {link.label}
              </a>
            ))}
            <a href="/">Marketing site</a>
            <button type="button" className="linkish" onClick={resetDemo}>
              Reset demo
            </button>
            <button type="button" className="linkish" onClick={logout}>
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="portal-main">{children}</main>
      <footer className="portal-footer">
        <div className="wrap">
          <span>Demo only — no live HMRC, MailGun, or Supabase connection yet.</span>
          <span>Signed-in as {session.email}</span>
        </div>
      </footer>
    </>
  );
}
