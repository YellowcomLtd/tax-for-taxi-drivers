import { useEffect, useState, type ReactNode } from 'react';
import { apiLogout, hydrateLiveStore } from '../lib/store';
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
    let cancelled = false;

    const sync = async () => {
      const store = await hydrateLiveStore();
      if (cancelled) return;
      const s = store?.session;
      if (!s) {
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

    void sync();
    const onUpdate = () => {
      void sync();
    };
    window.addEventListener('tft-portal-updated', onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('tft-portal-updated', onUpdate);
    };
  }, [requireRole]);

  async function logout() {
    await apiLogout();
    window.location.href = '/portal';
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
          { href: '/portal/admin/users', label: 'Users', key: 'users' },
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
          <nav className="portal-nav" aria-label="Portal">
            {links.map((link) => (
              <a key={link.key} href={link.href} aria-current={active === link.key ? 'page' : undefined}>
                {link.label}
              </a>
            ))}
            <a href="/">Marketing site</a>
            <button type="button" className="linkish" onClick={() => void logout()}>
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="portal-main">{children}</main>
      <footer className="portal-footer">
        <div className="wrap">
          <span>Secured portal · signed-in as {session.email}</span>
          <span>
            <a href="mailto:info@taxfortaxidrivers.co.uk">info@taxfortaxidrivers.co.uk</a>
          </span>
        </div>
      </footer>
    </>
  );
}
