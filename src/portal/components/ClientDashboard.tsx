import { useEffect, useState } from 'react';
import PortalChrome from './PortalChrome';
import StatusBadge from './StatusBadge';
import { formatDate, formatMoney, totalProfit } from '../lib/calc';
import { hydrateLiveStore } from '../lib/store';
import type { Submission } from '../lib/types';

export default function ClientDashboard() {
  const [subs, setSubs] = useState<Submission[]>([]);

  useEffect(() => {
    const sync = async () => {
      const store = await hydrateLiveStore();
      if (!store?.session) return;
      const uid = store.session.userId;
      setSubs(store.submissions.filter((s) => s.userId === uid).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    };
    void sync();
    const handler = () => void sync();
    window.addEventListener('tft-portal-updated', handler);
    return () => window.removeEventListener('tft-portal-updated', handler);
  }, []);

  const ready = subs.filter((s) => s.status === 'ready_to_sign').length;
  const awaiting = subs.filter((s) => s.status === 'client_signed').length;
  const signed = subs.filter((s) => s.status === 'signed').length;

  return (
    <PortalChrome requireRole="client" active="client">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 34 }}>My submissions</h1>
          <p className="portal-muted" style={{ marginTop: 6 }}>
            Enter income &amp; expenditure by month (usually a quarter), then sign when your accountant marks it ready.
          </p>
        </div>
        <a className="btn btn-y" href="/portal/client/new">
          New submission
        </a>
      </div>

      <div className="portal-grid-3" style={{ marginBottom: 22, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat">
          <div className="label">Total</div>
          <div className="value">{subs.length}</div>
        </div>
        <div className="stat">
          <div className="label">Ready to sign</div>
          <div className="value">{ready}</div>
        </div>
        <div className="stat">
          <div className="label">Awaiting counter-sign</div>
          <div className="value">{awaiting}</div>
        </div>
        <div className="stat">
          <div className="label">Signed</div>
          <div className="value">{signed}</div>
        </div>
      </div>

      <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="portal-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="portal-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Status</th>
                <th className="num">Profit</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && (
                <tr>
                  <td colSpan={5} className="portal-muted">
                    No submissions yet. Create your first return.
                  </td>
                </tr>
              )}
              {subs.map((sub) => (
                <tr key={sub.id}>
                  <td style={{ fontWeight: 700 }}>{sub.periodLabel}</td>
                  <td>
                    <StatusBadge status={sub.status} />
                  </td>
                  <td className="num">{formatMoney(totalProfit(sub, sub.lines))}</td>
                  <td>{formatDate(sub.updatedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="portal-actions" style={{ justifyContent: 'flex-end' }}>
                      <a className="btn btn-ghost" href={`/portal/client/submission?id=${sub.id}`}>
                        Open
                      </a>
                      {sub.status === 'ready_to_sign' && (
                        <a className="btn btn-y" href={`/portal/client/sign?id=${sub.id}`}>
                          Sign
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PortalChrome>
  );
}
