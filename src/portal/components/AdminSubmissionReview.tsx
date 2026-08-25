import { useMemo, useState } from 'react';
import PortalChrome from './PortalChrome';
import SubmissionForm from './SubmissionForm';
import StatusBadge from './StatusBadge';
import { downloadLockedDocument, printLockedDocument } from '../lib/pdf';
import { loadStore, updateStore } from '../lib/store';

function getId() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

export default function AdminSubmissionReview() {
  const id = useMemo(() => (typeof window !== 'undefined' ? getId() : ''), []);
  const [editing, setEditing] = useState(false);
  const store = loadStore();
  const sub = store.submissions.find((s) => s.id === id);
  const client = store.users.find((u) => u.id === sub?.userId);

  if (!sub) {
    return (
      <PortalChrome requireRole="admin" active="admin">
        <div className="portal-alert portal-alert-error">Submission not found.</div>
      </PortalChrome>
    );
  }

  function markReady() {
    updateStore((s) => {
      const item = s.submissions.find((x) => x.id === id);
      const person = s.users.find((u) => u.id === item?.userId);
      if (!item || item.status !== 'submitted') return;
      item.status = 'ready_to_sign';
      item.updatedAt = new Date().toISOString();
      s.notices.unshift({
        id: `notice_${Date.now()}`,
        at: new Date().toISOString(),
        to: person?.email || '',
        subject: 'Your declaration is ready to sign',
        body: `Please sign your ${item.periodLabel} submission in the portal.`,
      });
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
          <button type="button" className="btn btn-y" onClick={markReady}>
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
            <button type="button" className="btn btn-y" onClick={() => downloadLockedDocument(sub.signedDocumentHtml!, `signed-${sub.id}.html`)}>
              Download
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => printLockedDocument(sub.signedDocumentHtml!)}>
              Print / PDF
            </button>
          </>
        )}
      </div>

      <div className="portal-card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 28 }}>{client?.fullName || 'Client'}</h1>
            <p className="portal-muted" style={{ marginTop: 6 }}>
              {client?.email} · {sub.periodLabel}
            </p>
          </div>
          <StatusBadge status={sub.status} />
        </div>
        {sub.clientSignature && (
          <div className="portal-alert portal-alert-info" style={{ marginTop: 16 }}>
            Client signed by {sub.clientSignature.signerName} · {sub.clientSignature.signedAt && new Date(sub.clientSignature.signedAt).toLocaleString('en-GB')}
          </div>
        )}
        {sub.adminSignature && (
          <div className="portal-alert portal-alert-success" style={{ marginTop: 8 }}>
            Counter-signed by {sub.adminSignature.signerName} · hash {sub.adminSignature.documentHash.slice(0, 16)}…
          </div>
        )}
      </div>

      <SubmissionForm mode="edit" submissionId={id} viewOnly backHref="/portal/admin" />
    </PortalChrome>
  );
}
