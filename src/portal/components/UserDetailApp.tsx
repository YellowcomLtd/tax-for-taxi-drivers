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

  async function setRole(role: 'admin' | 'client') {
    if (!user) return;
    const label = role === 'admin' ? 'admin' : 'client';
    if (!window.confirm(`Make ${user.fullName} an ${label}?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/portal/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update role');
        return;
      }
      setUser(data.user);
      setDraft(data.user);
      setMessage(role === 'admin' ? 'Account upgraded to admin.' : 'Account set to client.');
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

  const letter = docs.find((d) => d.docType === 'letter_of_engagement');
  const contract = docs.find((d) => d.docType === 'contract_tax_returns');
  const packDocs = [letter, contract].filter(Boolean) as ClientDocument[];
  const signedCount = packDocs.filter((d) => d.status === 'signed').length;
  const packState =
    packDocs.length === 0
      ? 'none'
      : signedCount === packDocs.length
        ? 'approved'
        : signedCount > 0
          ? 'partial'
          : 'awaiting';

  function docStatusLabel(doc?: ClientDocument) {
    if (!doc) return { label: 'Not sent', tone: 'muted' as const };
    if (doc.status === 'signed') return { label: 'Approved', tone: 'ok' as const };
    return { label: 'Awaiting signature', tone: 'warn' as const };
  }

  return (
    <PortalChrome requireRole="admin" active="users">
      <div className="portal-actions user-detail-actions">
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
        {user.role === 'client' ? (
          <button type="button" className="btn btn-y" disabled={busy} onClick={() => void setRole('admin')}>
            Make admin
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void setRole('client')}>
            Make client
          </button>
        )}
      </div>

      <h1 className="user-detail-title">{user.fullName.replace(/\\+'/g, "'")}</h1>
      <p className="portal-muted user-detail-sub">
        {user.email}
        {user.tradeType ? ` · ${tradeLabel(user.tradeType)}` : ''}
        {user.active === false ? ' · Inactive' : ''}
      </p>

      {error && <div className="portal-alert portal-alert-error">{error}</div>}
      {message && <div className="portal-alert portal-alert-success">{message}</div>}

      <section className={`portal-card engagement-status engagement-${packState}`}>
        <div className="engagement-status-head">
          <div>
            <h2>Engagement pack</h2>
            <p className="portal-muted">
              {packState === 'approved' && 'Client has signed and approved both documents.'}
              {packState === 'partial' && 'Partially signed — one document still waiting.'}
              {packState === 'awaiting' && 'Sent — waiting for the client to sign.'}
              {packState === 'none' && 'No engagement pack sent yet.'}
            </p>
          </div>
          <span className={`engagement-badge engagement-badge-${packState}`}>
            {packState === 'approved' && 'Fully approved'}
            {packState === 'partial' && 'Partially approved'}
            {packState === 'awaiting' && 'Awaiting signature'}
            {packState === 'none' && 'Not sent'}
          </span>
        </div>
        <ul className="engagement-doc-list">
          {(
            [
              { key: 'letter', title: 'Letter of Engagement', doc: letter },
              { key: 'contract', title: 'Contract for Tax Returns', doc: contract },
            ] as const
          ).map((item) => {
            const status = docStatusLabel(item.doc);
            return (
              <li key={item.key} className={`engagement-doc engagement-doc-${status.tone}`}>
                <div>
                  <strong>{item.title}</strong>
                  {item.doc?.signedAt && (
                    <span className="portal-muted">Signed {formatDate(item.doc.signedAt)}</span>
                  )}
                  {!item.doc?.signedAt && item.doc?.sentAt && (
                    <span className="portal-muted">Sent {formatDate(item.doc.sentAt)}</span>
                  )}
                </div>
                <span className={`engagement-pill engagement-pill-${status.tone}`}>{status.label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="portal-grid-2 user-detail-grid">
        <section className="portal-card">
          <h2>At a glance</h2>
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
          <h2>Send / re-send pack</h2>
          <p className="portal-muted pack-help">
            Creates Letter of Engagement + Contract. Email only if you choose “Create &amp; email”.
          </p>
          <div className="field">
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

      <form className="portal-card portal-form user-detail-form" onSubmit={save}>
        <h2>Edit details</h2>
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

      <section className="portal-card portal-card-flush user-detail-block">
        <div className="portal-card-head">
          <h2>Submissions</h2>
        </div>
        <div className="portal-table-wrap portal-table-flush">
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
                  <td data-label="Period" style={{ fontWeight: 700 }}>
                    {s.periodLabel}
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={s.status} />
                  </td>
                  <td data-label="Updated">{formatDate(s.updatedAt)}</td>
                  <td data-label="" className="portal-row-action">
                    <a className="btn btn-ghost btn-compact" href={`/portal/admin/submission?id=${s.id}`}>
                      Review
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-card portal-card-flush">
        <div className="portal-card-head">
          <h2>All documents</h2>
        </div>
        <div className="portal-table-wrap portal-table-flush">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Signed</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr>
                  <td colSpan={4} className="portal-muted">
                    No engagement documents yet.
                  </td>
                </tr>
              )}
              {docs.map((d) => (
                <tr key={d.id}>
                  <td data-label="Document" style={{ fontWeight: 700 }}>
                    {d.title}
                  </td>
                  <td data-label="Status">
                    <span className={`engagement-pill engagement-pill-${d.status === 'signed' ? 'ok' : 'warn'}`}>
                      {d.status === 'signed' ? 'Approved' : 'Awaiting signature'}
                    </span>
                  </td>
                  <td data-label="Sent">{formatDate(d.sentAt)}</td>
                  <td data-label="Signed">{d.signedAt ? formatDate(d.signedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PortalChrome>
  );
}
