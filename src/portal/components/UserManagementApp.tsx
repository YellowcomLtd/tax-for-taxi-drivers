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

  async function refresh() {
    const store = await hydrateLiveStore();
    setUsers(store?.users || []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function sendEngagementPack(userId: string, fee?: string, notifyClient = true) {
    const res = await fetch('/api/portal/documents', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, feeAmount: fee || feeAmount, notifyClient }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not send engagement pack');
    return data as { mailSent?: boolean };
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
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
        setError(data.error || 'Could not create user');
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
          : `Account created for ${email}. No invite email sent (opt-in was off).`;
      setMessage(base + packNote);
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
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/portal/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, sendPasswordReset: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Reset failed');
        return;
      }
      setMessage(data.resetSent ? 'Password reset email sent.' : 'Reset link created but email failed — check Mailgun.');
    } finally {
      setBusy(false);
    }
  }

  async function sendPackForUser(user: User) {
    const fee = window.prompt('Annual fee for Contract (£ amount, optional — leave blank if not set):', feeAmount) ?? '';
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const pack = await sendEngagementPack(user.id, fee);
      setMessage(
        pack.mailSent
          ? `Engagement pack sent to ${user.fullName}.`
          : `Engagement pack created for ${user.fullName}; email failed — check Mailgun.`
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send pack');
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
        setError(data.error || 'Update failed');
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalChrome requireRole="admin" active="users">
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>User management</h1>
      <p className="portal-muted" style={{ marginBottom: 22 }}>
        Add drivers, send engagement packs (Letter of Engagement + Contract), and manage access.
      </p>

      {error && <div className="portal-alert portal-alert-error">{error}</div>}
      {message && <div className="portal-alert portal-alert-success">{message}</div>}

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
          <p className="portal-muted" style={{ marginBottom: 10, fontSize: 13 }}>
            Emails are off by default. Nothing is sent unless you tick a box below or use a Send button later.
          </p>
          <label style={{ display: 'flex', gap: 10, marginBottom: 10, fontWeight: 600 }}>
            <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
            Also email portal invite (set password link)
          </label>
          {role === 'client' && (
            <label style={{ display: 'flex', gap: 10, marginBottom: 14, fontWeight: 600 }}>
              <input type="checkbox" checked={sendPack} onChange={(e) => setSendPack(e.target.checked)} />
              Also email Letter of Engagement + Contract to sign
            </label>
          )}
          <button className="btn btn-y" type="submit" disabled={busy}>
            Create account
          </button>
        </form>

        <section className="portal-card">
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Email policy</h2>
          <ul style={{ marginLeft: 18, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.55 }}>
            <li>Creating or importing users never emails clients by itself.</li>
            <li>Invites, engagement packs, bulk mail and “ready to sign” only send when you choose to.</li>
            <li>Sign-in codes still email when someone logs in (required for 2FA).</li>
            <li>Engagement docs: Letter of Engagement + Contract — clients sign under Documents.</li>
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
                <th>Trade</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.tradeType ? tradeLabel(u.tradeType) : ' - '}</td>
                  <td>{u.active === false ? 'Inactive' : 'Active'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="portal-actions" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {u.role === 'client' && u.active !== false && (
                        <>
                          <button
                            type="button"
                            className="btn btn-y"
                            disabled={busy}
                            onClick={() => void sendPackForUser(u)}
                          >
                            Send engagement pack
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
