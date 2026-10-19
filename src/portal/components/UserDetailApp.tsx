import { useEffect, useMemo, useState } from 'react';
import PortalChrome from './PortalChrome';
import StatusBadge from './StatusBadge';
import { formatDate, tradeLabel } from '../lib/calc';
import type { ClientDocument, Submission, User } from '../lib/types';

function getId() {
  if (typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

export default function UserDetailApp() {
  const id = useMemo(() => getId(), []);
  const [user, setUser] = useState<User | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [packFee, setPackFee] = useState('');
  const [draft, setDraft] = useState<Partial<User>>({});

  async function load() {
    const res = await fetch(`/api/portal/users/${id}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not load user');
      setReady(true);
      return;
    }
    setUser(data.user);
    setDraft(data.user);
    setSubs(data.submissions || []);
    setDocs(data.documents || []);
    setReady(true);
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/portal/users/${user.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: draft.fullName,
          phone: draft.phone,
          companyName: draft.companyName,
          addressLine1: draft.addressLine1,
          addressLine2: draft.addressLine2,
          addressLine3: draft.addressLine3,
          city: draft.city,
          region: draft.region,
          postalCode: draft.postalCode,
          countryCode: draft.countryCode,
          utr: draft.utr,
          agentReference: draft.agentReference,
          notes: draft.notes,
          tradeType: draft.tradeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Save failed');
        return;
      }
      setUser(data.user);
      setDraft(data.user);
      setMessage('Client details saved.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  async function createPack(notifyClient: boolean) {
    if (!user) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/portal/documents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, feeAmount: packFee, notifyClient }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create engagement pack');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setMessage(
        notifyClient
          ? data.mailSent
            ? 'Engagement pack created and emailed.'
            : 'Engagement pack created; email failed — check Mailgun.'
          : 'Engagement pack created (no email sent). Client can sign under Documents once invited.'
      );
      await load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  async function setActive(active: boolean) {
    if (!user) return;
    const label = active ? 'reactivate' : 'deactivate';
    if (!window.confirm(`${label[0].toUpperCase()}${label.slice(1)} ${user.fullName}?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/portal/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Could not ${label}`);
        return;
      }
      setUser(data.user);
      setDraft(data.user);
      setMessage(active ? 'Account reactivated.' : 'Account deactivated.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    if (!user) return;
    if (!window.confirm(`Email a password reset link to ${user.email}?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/portal/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, sendPasswordReset: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not send reset email');
        return;
      }
      setMessage(data.resetSent ? 'Password reset email sent.' : 'Reset link created but email failed — check Mailgun.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <PortalChrome requireRole="admin" active="users">
        <p className="portal-muted">Loading client…</p>
      </PortalChrome>
    );
  }

  if (!user) {
    return (
      <PortalChrome requireRole="admin" active="users">
        <div className="portal-alert portal-alert-error">{error || 'Client not found'}</div>
        <a className="btn btn-ghost" href="/portal/admin/users">
          Back to users
        </a>
      </PortalChrome>
    );
  }

  const address = [user.addressLine1, user.addressLine2, user.addressLine3, user.city, user.postalCode]
    .filter(Boolean)
    .join(', ');

  return (
    <PortalChrome requireRole="admin" active="users">
      <div className="portal-actions" style={{ marginBottom: 16 }}>
        <a className="btn btn-ghost" href="/portal/admin/users">
          ← All users
        </a>
        <a className="btn btn-ghost" href={`/portal/admin/new?client=${user.id}`}>
          New submission
        </a>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void sendReset()}>
          Reset password
        </button>
        {user.active === false ? (
          <button type="button" className="btn btn-y" disabled={busy} onClick={() => void setActive(true)}>
            Reactivate
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void setActive(false)}>
            Deactivate
          </button>
        )}
      </div>

      <h1 style={{ fontSize: 34, marginBottom: 6 }}>{user.fullName.replace(/\\+'/g, "'")}</h1>
      <p className="portal-muted" style={{ marginBottom: 18 }}>
        {user.email}
        {user.tradeType ? ` · ${tradeLabel(user.tradeType)}` : ''}
        {user.active === false ? ' · Inactive' : ''}
      </p>

      {error && <div className="portal-alert portal-alert-error">{error}</div>}
      {message && <div className="portal-alert portal-alert-success">{message}</div>}

      <div className="portal-grid-2" style={{ marginBottom: 22 }}>
        <section className="portal-card">
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>At a glance</h2>
          <dl className="crm-dl">
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${user.email}`}>{user.email}</a>
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{user.phone || '—'}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{address || '—'}</dd>
            </div>
            <div>
              <dt>UTR</dt>
              <dd>{user.utr || '—'}</dd>
            </div>
            <div>
              <dt>GoCardless</dt>
              <dd>{user.gocardlessCustomerId || '—'}</dd>
            </div>
            <div>
              <dt>Agent reference</dt>
              <dd>{user.agentReference || '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="portal-card">
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Engagement pack</h2>
          <p className="portal-muted" style={{ marginBottom: 12, fontSize: 13 }}>
            Creates Letter of Engagement + Contract. Email only if you choose “Create &amp; email”.
          </p>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="packFee">Annual fee (£)</label>
            <input id="packFee" value={packFee} onChange={(e) => setPackFee(e.target.value)} placeholder="Optional" />
          </div>
          <div className="portal-actions">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void createPack(false)}>
              Create pack only
            </button>
            <button type="button" className="btn btn-y" disabled={busy} onClick={() => void createPack(true)}>
              Create &amp; email
            </button>
          </div>
        </section>
      </div>

      <form className="portal-card portal-form" onSubmit={save} style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 18, marginBottom: 14 }}>Edit details</h2>
        <div className="portal-grid-2">
          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              value={draft.fullName || ''}
              onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" value={draft.phone || ''} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="company">Company</label>
            <input
              id="company"
              value={draft.companyName || ''}
              onChange={(e) => setDraft((d) => ({ ...d, companyName: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="trade">Trade</label>
            <select
              id="trade"
              value={draft.tradeType || 'taxi'}
              onChange={(e) => setDraft((d) => ({ ...d, tradeType: e.target.value as 'taxi' | 'beautician' }))}
            >
              <option value="taxi">Taxi</option>
              <option value="beautician">Beautician</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="a1">Address line 1</label>
            <input
              id="a1"
              value={draft.addressLine1 || ''}
              onChange={(e) => setDraft((d) => ({ ...d, addressLine1: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="a2">Address line 2</label>
            <input
              id="a2"
              value={draft.addressLine2 || ''}
              onChange={(e) => setDraft((d) => ({ ...d, addressLine2: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="a3">Address line 3</label>
            <input
              id="a3"
              value={draft.addressLine3 || ''}
              onChange={(e) => setDraft((d) => ({ ...d, addressLine3: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="city">City</label>
            <input id="city" value={draft.city || ''} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="post">Postcode</label>
            <input
              id="post"
              value={draft.postalCode || ''}
              onChange={(e) => setDraft((d) => ({ ...d, postalCode: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="utr">UTR</label>
            <input id="utr" value={draft.utr || ''} onChange={(e) => setDraft((d) => ({ ...d, utr: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="agent">Agent reference</label>
            <input
              id="agent"
              value={draft.agentReference || ''}
              onChange={(e) => setDraft((d) => ({ ...d, agentReference: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="country">Country</label>
            <input
              id="country"
              value={draft.countryCode || ''}
              onChange={(e) => setDraft((d) => ({ ...d, countryCode: e.target.value }))}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            rows={3}
            value={draft.notes || ''}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </div>
        <button className="btn btn-y" type="submit" disabled={busy}>
          Save details
        </button>
      </form>

      <section className="portal-card" style={{ marginBottom: 22, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px' }}>
          <h2 style={{ fontSize: 18 }}>Submissions</h2>
        </div>
        <div className="portal-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="portal-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && (
                <tr>
                  <td colSpan={4} className="portal-muted">
                    No submissions yet.
                  </td>
                </tr>
              )}
              {subs.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700 }}>{s.periodLabel}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>{formatDate(s.updatedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <a className="btn btn-ghost" href={`/portal/admin/submission?id=${s.id}`}>
                      Review
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px' }}>
          <h2 style={{ fontSize: 18 }}>Documents</h2>
        </div>
        <div className="portal-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="portal-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Status</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr>
                  <td colSpan={3} className="portal-muted">
                    No engagement documents yet.
                  </td>
                </tr>
              )}
              {docs.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 700 }}>{d.title}</td>
                  <td>{d.status === 'signed' ? 'Signed' : 'Awaiting signature'}</td>
                  <td>{formatDate(d.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PortalChrome>
  );
}
