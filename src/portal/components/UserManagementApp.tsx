import { useEffect, useMemo, useState } from 'react';
import PortalChrome from './PortalChrome';
import { hydrateLiveStore } from '../lib/store';
import type { User } from '../lib/types';

function cleanName(value: string) {
  let out = value || '';
  for (let i = 0; i < 6; i++) {
    const next = out.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (next === out) break;
    out = next;
  }
  return out;
}

function titleCaseCity(city?: string) {
  if (!city) return '—';
  return city
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

type RoleFilter = 'all' | 'client' | 'admin';
type StatusFilter = 'all' | 'active' | 'inactive';
type UtrFilter = 'all' | 'has' | 'missing';

export default function UserManagementApp() {
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [utrFilter, setUtrFilter] = useState<UtrFilter>('all');

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => {
        if (roleFilter !== 'all' && u.role !== roleFilter) return false;
        if (statusFilter === 'active' && u.active === false) return false;
        if (statusFilter === 'inactive' && u.active !== false) return false;
        if (utrFilter === 'has' && !u.utr) return false;
        if (utrFilter === 'missing' && u.utr) return false;
        if (!q) return true;
        const hay = [u.fullName, u.email, u.city, u.utr, u.postalCode, u.agentReference]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => cleanName(a.fullName).localeCompare(cleanName(b.fullName), 'en', { sensitivity: 'base' }));
  }, [users, search, roleFilter, statusFilter, utrFilter]);

  const counts = useMemo(() => {
    const clients = users.filter((u) => u.role === 'client');
    return {
      total: users.length,
      clients: clients.length,
      withUtr: clients.filter((u) => Boolean(u.utr)).length,
      inactive: users.filter((u) => u.active === false).length,
    };
  }, [users]);

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
      setShowAdd(false);
      await refresh();
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
            ? `Engagement pack created and emailed to ${cleanName(packFor.fullName)}.`
            : `Engagement pack created for ${cleanName(packFor.fullName)}; email failed — check Mailgun.`
          : `Engagement pack created for ${cleanName(packFor.fullName)} (no email sent).`
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
    setBusy(true);
    setImportProgress('Starting import… (no emails will be sent)');
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/portal/import-clients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.error || `Import failed (${res.status})`);
        return;
      }
      showFeedback(
        'message',
        `Import complete (no emails). Created ${data.created}, updated ${data.updated}, skipped ${data.skipped}. UTR matched ${data.utrMatched}.`
      );
      await refresh();
    } catch (err) {
      showFeedback(
        'error',
        err instanceof Error
          ? `Import failed: ${err.message}. The request may have timed out — try again.`
          : 'Import failed.'
      );
    } finally {
      setBusy(false);
      setImportProgress('');
    }
  }

  return (
    <PortalChrome requireRole="admin" active="users">
      <div className="users-head">
        <div>
          <h1>Users</h1>
          <p className="portal-muted">
            {counts.clients} clients
            {counts.withUtr ? ` · ${counts.withUtr} with UTR` : ''}
            {counts.inactive ? ` · ${counts.inactive} inactive` : ''}
          </p>
        </div>
        <div className="portal-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? 'Close form' : 'Add user'}
          </button>
          <button
            type="button"
            className="btn btn-y"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  'Import GoCardless + HMRC list?\n\nCreates/updates accounts only.\nNo emails will be sent.'
                )
              ) {
                void runImport();
              }
            }}
          >
            {busy && importProgress ? 'Importing…' : 'Import list'}
          </button>
        </div>
      </div>

      {error && <div className="portal-alert portal-alert-error">{error}</div>}
      {message && <div className="portal-alert portal-alert-success">{message}</div>}
      {importProgress && <div className="portal-alert portal-alert-info">{importProgress}</div>}

      {packFor && (
        <div className="portal-card users-pack-panel">
          <div className="users-pack-head">
            <div>
              <h2>Engagement pack</h2>
              <p className="portal-muted">{cleanName(packFor.fullName)}</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => setPackFor(null)}>
              Cancel
            </button>
          </div>
          <div className="portal-form users-pack-form">
            <div className="field">
              <label htmlFor="inlinePackFee">Annual fee (£)</label>
              <input
                id="inlinePackFee"
                value={packFee}
                onChange={(e) => setPackFee(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <label className="email-opt">
              <input type="checkbox" checked={packEmail} onChange={(e) => setPackEmail(e.target.checked)} />
              <span>Also email the client</span>
            </label>
            <button type="button" className="btn btn-y" disabled={busy} onClick={() => void confirmPack()}>
              Create pack
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <form className="portal-card portal-form users-add" onSubmit={createUser}>
          <h2>Add user</h2>
          <div className="users-add-grid">
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
                <option value="client">Client</option>
                <option value="admin">Admin</option>
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
                  <label htmlFor="fee">Annual fee (£)</label>
                  <input id="fee" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="Optional" />
                </div>
              </>
            )}
          </div>
          <div className="email-opts">
            <p className="email-opts-note">Emails off by default — only send if you tick a box.</p>
            <label className="email-opt">
              <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
              <span>Email portal invite</span>
            </label>
            {role === 'client' && (
              <label className="email-opt">
                <input type="checkbox" checked={sendPack} onChange={(e) => setSendPack(e.target.checked)} />
                <span>Email engagement pack</span>
              </label>
            )}
          </div>
          <button className="btn btn-y" type="submit" disabled={busy}>
            Create account
          </button>
        </form>
      )}

      <div className="users-toolbar">
        <input
          className="users-search"
          type="search"
          placeholder="Search name, email, city, UTR…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)} aria-label="Filter by role">
          <option value="all">All roles</option>
          <option value="client">Clients</option>
          <option value="admin">Admins</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={utrFilter} onChange={(e) => setUtrFilter(e.target.value as UtrFilter)} aria-label="Filter by UTR">
          <option value="all">UTR: all</option>
          <option value="has">Has UTR</option>
          <option value="missing">Missing UTR</option>
        </select>
      </div>

      <p className="users-result-count portal-muted">
        Showing {filtered.length} of {users.length}
      </p>

      <section className="portal-card users-table-card users-desktop">
        <div className="portal-table-wrap users-table-wrap">
          <table className="portal-table users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>City</th>
                <th>UTR</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="portal-muted">
                    No users match these filters.
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <a className="users-name" href={`/portal/admin/users/${u.id}`}>
                      {cleanName(u.fullName)}
                    </a>
                  </td>
                  <td className="users-email">{u.email}</td>
                  <td>{titleCaseCity(u.city)}</td>
                  <td className="users-utr">{u.utr || '—'}</td>
                  <td>
                    <span className={`users-pill ${u.role === 'admin' ? 'admin' : 'client'}`}>{u.role}</span>
                  </td>
                  <td>
                    <span className={`users-pill ${u.active === false ? 'inactive' : 'active'}`}>
                      {u.active === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="users-actions">
                    <a className="btn btn-ghost btn-compact" href={`/portal/admin/users/${u.id}`}>
                      Open
                    </a>
                    {u.role === 'client' && u.active !== false && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-compact"
                        disabled={busy}
                        onClick={() => {
                          setPackFor(u);
                          setPackFee(feeAmount);
                          setPackEmail(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Pack
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="users-mobile-list">
        {filtered.length === 0 && <p className="portal-muted">No users match these filters.</p>}
        {filtered.map((u) => (
          <article key={u.id} className="users-mobile-card">
            <div className="users-mobile-top">
              <a className="users-name" href={`/portal/admin/users/${u.id}`}>
                {cleanName(u.fullName)}
              </a>
              <div className="users-mobile-pills">
                <span className={`users-pill ${u.role === 'admin' ? 'admin' : 'client'}`}>{u.role}</span>
                <span className={`users-pill ${u.active === false ? 'inactive' : 'active'}`}>
                  {u.active === false ? 'Inactive' : 'Active'}
                </span>
              </div>
            </div>
            <p className="users-email">{u.email}</p>
            <dl className="users-mobile-meta">
              <div>
                <dt>City</dt>
                <dd>{titleCaseCity(u.city)}</dd>
              </div>
              <div>
                <dt>UTR</dt>
                <dd className="users-utr">{u.utr || '—'}</dd>
              </div>
            </dl>
            <div className="users-mobile-actions">
              <a className="btn btn-y btn-compact" href={`/portal/admin/users/${u.id}`}>
                Open profile
              </a>
              {u.role === 'client' && u.active !== false && (
                <button
                  type="button"
                  className="btn btn-ghost btn-compact"
                  disabled={busy}
                  onClick={() => {
                    setPackFor(u);
                    setPackFee(feeAmount);
                    setPackEmail(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Pack
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </PortalChrome>
  );
}
