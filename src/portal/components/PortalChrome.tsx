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
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => {
    document.body.classList.toggle('portal-nav-lock', menuOpen);
    return () => document.body.classList.remove('portal-nav-lock');
  }, [menuOpen]);

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
          { href: '/portal/admin/new', label: 'New submission', key: 'new' },
          { href: '/portal/admin/users', label: 'Users', key: 'users' },
          { href: '/portal/admin/email', label: 'Bulk email', key: 'email' },
        ]
      : [
          { href: '/portal/client', label: 'My submissions', key: 'client' },
          { href: '/portal/client/documents', label: 'Documents', key: 'documents' },
          { href: '/portal/client/new', label: 'New submission', key: 'new' },
        ];

  function closeMenu() {
    setMenuOpen(false);
  }

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
          <nav className="portal-nav portal-nav-desktop" aria-label="Portal">
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
          <button
            type="button"
            className="portal-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="portal-mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="portal-menu-box" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
        {menuOpen && (
          <div className="portal-mobile-nav" id="portal-mobile-nav">
            <nav className="portal-mobile-links" aria-label="Portal mobile">
              {links.map((link) => (
                <a
                  key={link.key}
                  href={link.href}
                  aria-current={active === link.key ? 'page' : undefined}
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              ))}
              <a href="/" onClick={closeMenu}>
                Marketing site
              </a>
              <button type="button" className="linkish" onClick={() => void logout()}>
                Log out
              </button>
            </nav>
          </div>
        )}
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
