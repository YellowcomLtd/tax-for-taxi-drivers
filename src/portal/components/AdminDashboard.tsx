import { useEffect, useMemo, useState } from 'react';
import PortalChrome from './PortalChrome';
import StatusBadge from './StatusBadge';
import { formatDate, formatMoney, totalProfit, tradeLabel } from '../lib/calc';
import { hydrateLiveStore, loadStore } from '../lib/store';
import type { Submission, User } from '../lib/types';

export default function AdminDashboard() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<'all' | Submission['status']>('all');

  async function sync() {
    const store = await hydrateLiveStore();
    if (!store) return;
    setSubs([...store.submissions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setUsers(store.users.filter((u) => u.role === 'client'));
  }

  useEffect(() => {
    void sync();
    const handler = () => void sync();
    window.addEventListener('tft-portal-updated', handler);
    return () => window.removeEventListener('tft-portal-updated', handler);
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? subs : subs.filter((s) => s.status === filter)),
    [subs, filter]
  );

  function clientName(userId: string) {
    return users.find((u) => u.id === userId)?.fullName || userId;
  }

  async function markReady(id: string) {
    const store = loadStore();
    const sub = store.submissions.find((x) => x.id === id);
    if (!sub || sub.status !== 'submitted') return;
    const updated = { ...sub, status: 'ready_to_sign' as const, updatedAt: new Date().toISOString() };
    const res = await fetch('/api/portal/submissions', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (!res.ok) return;
    await fetch('/api/portal/email/notify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: id }),
    });
    await sync();
  }

  const counts = {
    clients: users.length,
    submitted: subs.filter((s) => s.status === 'submitted').length,
    ready: subs.filter((s) => s.status === 'ready_to_sign').length,
    counter: subs.filter((s) => s.status === 'client_signed').length,
    signed: subs.filter((s) => s.status === 'signed').length,
  };

  return (
    <PortalChrome requireRole="admin" active="admin">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 34 }}>Admin dashboard</h1>
          <p className="portal-muted" style={{ marginTop: 6 }}>
            Review submissions, edit records, send for client sign-off, then counter-sign to lock.
          </p>
        </div>
        <div className="portal-actions">
          <a className="btn btn-ghost" href="/portal/admin/users">
            Manage users
          </a>
          <a className="btn btn-y" href="/portal/admin/email">
            Compose bulk email
          </a>
        </div>
      </div>

      <div className="portal-grid-3" style={{ marginBottom: 22, gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="stat">
          <div className="label">Clients</div>
          <div className="value">{counts.clients}</div>
        </div>
        <div className="stat">
          <div className="label">Submitted</div>
          <div className="value">{counts.submitted}</div>
        </div>
        <div className="stat">
          <div className="label">Ready to sign</div>
          <div className="value">{counts.ready}</div>
        </div>
        <div className="stat">
          <div className="label">Counter-sign</div>
          <div className="value">{counts.counter}</div>
        </div>
        <div className="stat">
          <div className="label">Signed</div>
          <div className="value">{counts.signed}</div>
        </div>
      </div>

      <section className="portal-card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 20, marginBottom: 14 }}>Clients</h2>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Trade</th>
                <th>Submissions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="portal-muted">
                    No clients yet. Add drivers under Users.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.tradeType ? tradeLabel(u.tradeType) : ' - '}</td>
                  <td>{subs.filter((s) => s.userId === u.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: 20 }}>Submissions</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', fontWeight: 700 }}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="ready_to_sign">Ready to sign</option>
            <option value="client_signed">Awaiting counter-sign</option>
            <option value="signed">Fully signed</option>
          </select>
        </div>
        <div className="portal-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="portal-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Period</th>
                <th>Status</th>
                <th className="num">Profit</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((sub) => (
                <tr key={sub.id}>
                  <td style={{ fontWeight: 700 }}>{clientName(sub.userId)}</td>
                  <td>{sub.periodLabel}</td>
                  <td>
                    <StatusBadge status={sub.status} />
                  </td>
                  <td className="num">{formatMoney(totalProfit(sub, sub.lines))}</td>
                  <td>{formatDate(sub.updatedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="portal-actions" style={{ justifyContent: 'flex-end' }}>
                      <a className="btn btn-ghost" href={`/portal/admin/submission?id=${sub.id}`}>
                        Review
                      </a>
                      {sub.status === 'submitted' && (
                        <button type="button" className="btn btn-y" onClick={() => void markReady(sub.id)}>
                          Mark ready to sign
                        </button>
                      )}
                      {sub.status === 'client_signed' && (
                        <a className="btn btn-y" href={`/portal/admin/sign?id=${sub.id}`}>
                          Counter-sign
                        </a>
                      )}
                      {sub.status === 'signed' && sub.signedDocumentHtml && (
                        <a
                          className="btn btn-ghost"
                          href={`data:text/html;charset=utf-8,${encodeURIComponent(sub.signedDocumentHtml)}`}
                          download={`signed-${sub.id}.html`}
                        >
                          PDF
                        </a>
                      )}
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
