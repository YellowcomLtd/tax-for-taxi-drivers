import { useEffect, useMemo, useState } from 'react';
import PortalChrome from './PortalChrome';
import SubmissionForm from './SubmissionForm';
import StatusBadge from './StatusBadge';
import { downloadLockedDocument, printLockedDocument } from '../lib/pdf';
import { hydrateLiveStore, loadStore, persistSubmissionLive } from '../lib/store';
import type { Submission, User } from '../lib/types';

function getId() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

export default function AdminSubmissionReview() {
  const id = useMemo(() => (typeof window !== 'undefined' ? getId() : ''), []);
  const [editing, setEditing] = useState(false);
  const [sub, setSub] = useState<Submission | null>(null);
  const [client, setClient] = useState<User | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const store = await hydrateLiveStore();
      if (!store) return;
      const found = store.submissions.find((s) => s.id === id) || null;
      setSub(found);
      setClient(store.users.find((u) => u.id === found?.userId));
      setReady(true);
    })();
  }, [id]);

  if (!ready) {
    return (
      <PortalChrome requireRole="admin" active="admin">
        <p className="portal-muted">Loading…</p>
      </PortalChrome>
    );
  }

  if (!sub) {
    return (
      <PortalChrome requireRole="admin" active="admin">
        <div className="portal-alert portal-alert-error">Submission not found.</div>
      </PortalChrome>
    );
  }

  async function markReady() {
    const current = loadStore().submissions.find((x) => x.id === id);
    if (!current || current.status !== 'submitted') return;
    const updated = { ...current, status: 'ready_to_sign' as const, updatedAt: new Date().toISOString() };
    const saved = await persistSubmissionLive(updated);
    if (!saved) return;
    await fetch('/api/portal/email/notify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: id }),
    });
    window.location.reload();
  }

  if (editing && sub.status !== 'signed') {
    return (
      <PortalChrome requireRole="admin" active="admin">
        <div className="portal-actions" style={{ marginBottom: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
            ← View mode
          </button>
        </div>
        <SubmissionForm mode="edit" submissionId={id} adminEdit backHref={`/portal/admin/submission?id=${id}`} />
      </PortalChrome>
    );
  }

  return (
    <PortalChrome requireRole="admin" active="admin">
      <div className="portal-actions" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <a className="btn btn-ghost" href="/portal/admin">
          ← Dashboard
        </a>
        {sub.status !== 'signed' && (
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit records
          </button>
        )}
        {sub.status === 'submitted' && (
          <button type="button" className="btn btn-y" onClick={() => void markReady()}>
            Mark ready to sign
          </button>
        )}
        {sub.status === 'client_signed' && (
          <a className="btn btn-y" href={`/portal/admin/sign?id=${sub.id}`}>
            Counter-sign
          </a>
        )}
        {sub.status === 'signed' && sub.signedDocumentHtml && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => downloadLockedDocument(sub.signedDocumentHtml!, `signed-${sub.id}.html`)}>
              Download
            </button>
            <button type="button" className="btn btn-y" onClick={() => printLockedDocument(sub.signedDocumentHtml!)}>
              Print / PDF
            </button>
          </>
        )}
      </div>

      <div className="portal-card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 28 }}>{sub.periodLabel}</h1>
            <p className="portal-muted" style={{ marginTop: 6 }}>
              {client?.fullName || sub.userId} · {client?.email}
            </p>
          </div>
          <StatusBadge status={sub.status} />
        </div>
      </div>

      <SubmissionForm mode="edit" submissionId={id} adminEdit viewOnly backHref={`/portal/admin/submission?id=${id}`} />
    </PortalChrome>
  );
}
