import { useEffect, useState } from 'react';
import PortalChrome from './PortalChrome';
import { hydrateLiveStore } from '../lib/store';
import type { User } from '../lib/types';
import { tradeLabel } from '../lib/calc';

export default function UserManagementApp() {
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'client' | 'admin'>('client');
  const [tradeType, setTradeType] = useState<'taxi' | 'beautician'>('taxi');
  const [sendInvite, setSendInvite] = useState(false);
  const [sendPack, setSendPack] = useState(false);
  const [feeAmount, setFeeAmount] = useState('');
  const [packFor, setPackFor] = useState<User | null>(null);
  const [packFee, setPackFee] = useState('');
  const [packEmail, setPackEmail] = useState(false);

  async function refresh() {
    const store = await hydrateLiveStore();
    setUsers(store?.users || []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  function showFeedback(kind: 'error' | 'message', text: string) {
    if (kind === 'error') {
      setError(text);
      setMessage('');
    } else {
      setMessage(text);
      setError('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function sendEngagementPack(userId: string, fee: string, notifyClient: boolean) {
    const res = await fetch('/api/portal/documents', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, feeAmount: fee, notifyClient }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not create engagement pack');
    return data as { mailSent?: boolean };
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/portal/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          role,
          tradeType: role === 'client' ? tradeType : null,
          sendInvite,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.error || 'Could not create user');
        return;
      }

      let packNote = '';
      if (role === 'client' && sendPack && data.user?.id) {
        try {
          const pack = await sendEngagementPack(data.user.id, feeAmount, true);
          packNote = pack.mailSent
            ? ' Engagement pack emailed.'
            : ' Engagement pack created; email failed — check Mailgun.';
        } catch (err) {
          packNote = ` Engagement pack failed: ${err instanceof Error ? err.message : 'unknown error'}`;
        }
      }

      const base = data.inviteSent
        ? `Account created and invite emailed to ${email}.`
        : sendInvite
          ? `Account created for ${email}. Invite email failed — check Mailgun.`
          : `Account created for ${email}. No invite email sent.`;
      showFeedback('message', base + packNote);
      setFullName('');
      setEmail('');
      setFeeAmount('');
      setSendInvite(false);
      setSendPack(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(userId: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/portal/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, sendPasswordReset: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.error || 'Reset failed');
        return;
      }
      showFeedback(
        'message',
        data.resetSent ? 'Password reset email sent.' : 'Reset link created but email failed — check Mailgun.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmPack() {
    if (!packFor) return;
    setBusy(true);
    try {
      const pack = await sendEngagementPack(packFor.id, packFee, packEmail);
      showFeedback(
        'message',
        packEmail
          ? pack.mailSent
            ? `Engagement pack created and emailed to ${packFor.fullName}.`
            : `Engagement pack created for ${packFor.fullName}; email failed — check Mailgun.`
          : `Engagement pack created for ${packFor.fullName} (no email sent).`
      );
      setPackFor(null);
      setPackFee('');
      setPackEmail(false);
      await refresh();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Could not create pack');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    const ok = window.confirm(
      'Import GoCardless customers + match HMRC UTRs?\n\nThis creates/updates client accounts only.\nNo invite or engagement emails will be sent.'
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch('/api/portal/import-clients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.error || 'Import failed');
        return;
      }
      showFeedback(
        'message',
        `Import complete (no emails). Created ${data.created}, updated ${data.updated}, skipped ${data.skipped}. UTR matched ${data.utrMatched}.`
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user: User) {
    setBusy(true);
    try {
      const res = await fetch('/api/portal/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, active: user.active === false }),
      });
      if (!res.ok) {
        const data = await res.json();
        showFeedback('error', data.error || 'Update failed');
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const clients = users.filter((u) => u.role === 'client');

  return (
    <PortalChrome requireRole="admin" active="users">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 34, marginBottom: 8 }}>Users</h1>
          <p className="portal-muted">
            Client CRM — open a person for address, UTR and documents. Emails stay off unless you choose to send.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void runImport()}>
          Import GoCardless / HMRC list
        </button>
      </div>

      {error && <div className="portal-alert portal-alert-error">{error}</div>}
      {message && <div className="portal-alert portal-alert-success">{message}</div>}

      {packFor && (
        <div className="portal-card" style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Engagement pack — {packFor.fullName}</h2>
          <p className="portal-muted" style={{ marginBottom: 12, fontSize: 13 }}>
            Creates Letter of Engagement + Contract. Choose whether to email them now.
          </p>
          <div className="portal-form">
            <div className="field">
              <label htmlFor="inlinePackFee">Annual fee (£)</label>
              <input
                id="inlinePackFee"
                value={packFee}
                onChange={(e) => setPackFee(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <label className="email-opt" style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={packEmail} onChange={(e) => setPackEmail(e.target.checked)} />
              <span>Also email the client about these documents</span>
            </label>
            <div className="portal-actions">
              <button type="button" className="btn btn-y" disabled={busy} onClick={() => void confirmPack()}>
                Create pack
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setPackFor(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="portal-grid-2" style={{ marginBottom: 28 }}>
        <form className="portal-card portal-form" onSubmit={createUser}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Add user</h2>
          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="newEmail">Email</label>
            <input id="newEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value as 'client' | 'admin')}>
              <option value="client">Driver / client</option>
              <option value="admin">Admin staff</option>
            </select>
          </div>
          {role === 'client' && (
            <>
              <div className="field">
                <label htmlFor="trade">Trade</label>
                <select
                  id="trade"
                  value={tradeType}
                  onChange={(e) => setTradeType(e.target.value as 'taxi' | 'beautician')}
                >
                  <option value="taxi">Taxi</option>
                  <option value="beautician">Beautician</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="fee">Annual contract fee (£)</label>
                <input
                  id="fee"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="e.g. 540"
                />
              </div>
            </>
          )}
          <div className="email-opts">
            <p className="email-opts-note">
              Emails are off by default. Nothing is sent unless you tick a box below or use a Send button later.
            </p>
            <label className="email-opt">
              <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
              <span>Also email portal invite (set password link)</span>
            </label>
            {role === 'client' && (
              <label className="email-opt">
                <input type="checkbox" checked={sendPack} onChange={(e) => setSendPack(e.target.checked)} />
                <span>Also email Letter of Engagement + Contract to sign</span>
              </label>
            )}
          </div>
          <button className="btn btn-y" type="submit" disabled={busy}>
            Create account
          </button>
        </form>

        <section className="portal-card">
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Clients in portal</h2>
          <p style={{ color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.55, marginBottom: 10 }}>
            {clients.length} client{clients.length === 1 ? '' : 's'} loaded. Click a name for the full record
            (address, UTR, submissions, documents).
          </p>
          <ul style={{ marginLeft: 18, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.55 }}>
            <li>Import uses GoCardless emails/addresses and matches HMRC UTRs by name where possible.</li>
            <li>Import never sends invites or engagement emails.</li>
            <li>Engagement packs: use “Send engagement pack”, then choose create only or create &amp; email.</li>
          </ul>
        </section>
      </div>

      <section className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="portal-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="portal-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>City</th>
                <th>UTR</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>
                    <a href={`/portal/admin/users/${u.id}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                      {u.fullName}
                    </a>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.city || (u.tradeType ? tradeLabel(u.tradeType) : '—')}</td>
                  <td>{u.utr || '—'}</td>
                  <td>{u.active === false ? 'Inactive' : 'Active'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="portal-actions" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <a className="btn btn-ghost" href={`/portal/admin/users/${u.id}`}>
                        Open
                      </a>
                      {u.role === 'client' && u.active !== false && (
                        <>
                          <button
                            type="button"
                            className="btn btn-y"
                            disabled={busy}
                            onClick={() => {
                              setPackFor(u);
                              setPackFee(feeAmount);
                              setPackEmail(false);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            Engagement pack
                          </button>
                          <a className="btn btn-ghost" href={`/portal/admin/new?client=${u.id}`}>
                            New submission
                          </a>
                        </>
                      )}
                      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void sendReset(u.id)}>
                        Reset password
                      </button>
                      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void toggleActive(u)}>
                        {u.active === false ? 'Reactivate' : 'Deactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PortalChrome>
  );
}
