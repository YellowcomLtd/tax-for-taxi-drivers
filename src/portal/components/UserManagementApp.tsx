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

  async function refresh() {
    const store = await hydrateLiveStore();
    setUsers(store?.users || []);
  }

  useEffect(() => {
    void refresh();
  }, []);

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
        body: JSON.stringify({ fullName, email, role, tradeType: role === 'client' ? tradeType : null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create user');
        return;
      }
      setMessage(
        data.inviteSent
          ? `Account created and invite emailed to ${email}.`
          : `Account created for ${email}. Invite email could not be sent — check Mailgun.`
      );
      setFullName('');
      setEmail('');
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
        Add drivers and admin staff, send password resets, and deactivate accounts. Invites and resets are sent via Mailgun.
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
            <div className="field">
              <label htmlFor="trade">Trade</label>
              <select id="trade" value={tradeType} onChange={(e) => setTradeType(e.target.value as 'taxi' | 'beautician')}>
                <option value="taxi">Taxi</option>
                <option value="beautician">Beautician</option>
              </select>
            </div>
          )}
          <button className="btn btn-y" type="submit" disabled={busy}>
            Create &amp; email invite
          </button>
        </form>

        <section className="portal-card">
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Security</h2>
          <ul style={{ marginLeft: 18, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.55 }}>
            <li>Roles are stored in Supabase app metadata (not editable by users).</li>
            <li>Each driver can only access their own submissions.</li>
            <li>Password resets use single-use recovery links emailed via Mailgun.</li>
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
                    <div className="portal-actions" style={{ justifyContent: 'flex-end' }}>
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
