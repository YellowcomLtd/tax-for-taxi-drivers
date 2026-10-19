import { useEffect, useMemo, useState } from 'react';
import PortalChrome from './PortalChrome';
import SubmissionForm from './SubmissionForm';
import { hydrateLiveStore } from '../lib/store';
import type { User } from '../lib/types';
import { tradeLabel } from '../lib/calc';

function clientIdFromQuery() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('client') || '';
}

export default function AdminNewSubmission() {
  const [clients, setClients] = useState<User[]>([]);
  const [ready, setReady] = useState(false);
  const [clientId, setClientId] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    void (async () => {
      const store = await hydrateLiveStore();
      const list = (store?.users || []).filter((u) => u.role === 'client' && u.active !== false);
      setClients(list);
      const fromQuery = clientIdFromQuery();
      if (fromQuery && list.some((u) => u.id === fromQuery)) {
        setClientId(fromQuery);
        setStarted(true);
      } else if (list.length === 1) {
        setClientId(list[0].id);
      }
      setReady(true);
    })();
  }, []);

  const selected = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);

  if (!ready) {
    return (
      <PortalChrome requireRole="admin" active="new">
        <p className="portal-muted">Loading…</p>
      </PortalChrome>
    );
  }

  if (clients.length === 0) {
    return (
      <PortalChrome requireRole="admin" active="new">
        <h1 style={{ fontSize: 34, marginBottom: 8 }}>New submission for a client</h1>
        <div className="portal-alert portal-alert-info">
          No active clients yet. Add a driver under{' '}
          <a href="/portal/admin/users">Users</a> first.
        </div>
      </PortalChrome>
    );
  }

  if (!started || !selected) {
    return (
      <PortalChrome requireRole="admin" active="new">
        <h1 style={{ fontSize: 34, marginBottom: 8 }}>New submission for a client</h1>
        <p className="portal-muted" style={{ marginBottom: 22 }}>
          Create income &amp; expenditure figures and attach supporting files on a driver’s behalf.
        </p>
        <form
          className="portal-card portal-form"
          style={{ maxWidth: 520 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!clientId) return;
            setStarted(true);
          }}
        >
          <div className="field">
            <label htmlFor="client">Client</label>
            <select
              id="client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.email})
                  {c.tradeType ? ` · ${tradeLabel(c.tradeType)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="portal-actions">
            <button className="btn btn-y" type="submit" disabled={!clientId}>
              Continue
            </button>
            <a className="btn btn-ghost" href="/portal/admin">
              Cancel
            </a>
          </div>
        </form>
      </PortalChrome>
    );
  }

  return (
    <PortalChrome requireRole="admin" active="new">
      <div className="portal-actions" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setStarted(false);
          }}
        >
          ← Change client
        </button>
      </div>
      <SubmissionForm
        mode="create"
        adminEdit
        forClientId={selected.id}
        forTradeType={selected.tradeType || 'taxi'}
        clientLabel={selected.fullName}
        backHref="/portal/admin"
      />
    </PortalChrome>
  );
}
