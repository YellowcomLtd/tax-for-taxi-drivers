import { useEffect, useMemo, useState } from 'react';
import PortalChrome from './PortalChrome';
import StatusBadge from './StatusBadge';
import { formatDate, formatMoney, totalProfit, tradeLabel } from '../lib/calc';
import { loadStore, updateStore } from '../lib/store';
import type { Submission, User } from '../lib/types';

export default function AdminDashboard() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<'all' | Submission['status']>('all');

  function sync() {
    const store = loadStore();
    setSubs([...store.submissions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setUsers(store.users.filter((u) => u.role === 'client'));
  }

  useEffect(() => {
    sync();
    window.addEventListener('tft-portal-updated', sync);
    return () => window.removeEventListener('tft-portal-updated', sync);
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? subs : subs.filter((s) => s.status === filter)),
    [subs, filter]
  );

  function clientName(userId: string) {
    return users.find((u) => u.id === userId)?.fullName || userId;
  }

  function markReady(id: string) {
    updateStore((s) => {
      const sub = s.submissions.find((x) => x.id === id);
      const client = s.users.find((u) => u.id === sub?.userId);
      if (!sub || sub.status !== 'submitted') return;
      sub.status = 'ready_to_sign';
      sub.updatedAt = new Date().toISOString();
      s.notices.unshift({
        id: `notice_${Date.now()}`,
        at: new Date().toISOString(),
        to: client?.email || '',
        subject: 'Your declaration is ready to sign',
        body: `Demo MailGun email: please sign your ${sub.periodLabel} submission in the portal.`,
      });
    });
    sync();
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
          <p className="portal-muted" style={{ marginTop: 6 }}>Review submissions, edit records, send for client sign-off, then counter-sign to lock.</p>
        </div>
        <a className="btn btn-y" href="/portal/admin/email">Compose bulk email</a>
      </div>

      <div className="portal-grid-3" style={{ marginBottom: 22, gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="stat"><div className="label">Clients</div><div className="value">{counts.clients}</div></div>
        <div className="stat"><div className="label">Submitted</div><div className="value">{counts.submitted}</div></div>
        <div className="stat"><div className="label">Ready to sign</div><div className="value">{counts.ready}</div></div>
        <div className="stat"><div className="label">Counter-sign</div><div className="value">{counts.counter}</div></div>
        <div className="stat"><div className="label">Signed</div><div className="value">{counts.signed}</div></div>
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
        <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ fontSize: 20 }}>Submissions</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', fontWeight: 700 }}>
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
                  <td><StatusBadge status={sub.status} /></td>
                  <td className="num">{formatMoney(totalProfit(sub, sub.lines))}</td>
                  <td>{formatDate(sub.updatedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="portal-actions" style={{ justifyContent: 'flex-end' }}>
                      <a className="btn btn-ghost" href={`/portal/admin/submission?id=${sub.id}`}>Review</a>
                      {sub.status === 'submitted' && (
                        <button type="button" className="btn btn-y" onClick={() => markReady(sub.id)}>
                          Mark ready to sign
                        </button>
                      )}
                      {sub.status === 'client_signed' && (
                        <a className="btn btn-y" href={`/portal/admin/sign?id=${sub.id}`}>Counter-sign</a>
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
