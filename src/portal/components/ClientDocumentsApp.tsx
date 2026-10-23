import { useEffect, useState } from 'react';
import PortalChrome from './PortalChrome';
import { formatDate } from '../lib/calc';
import { hydrateLiveStore } from '../lib/store';
import type { ClientDocument, ClientFile } from '../lib/types';

export default function ClientDocumentsApp() {
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [files, setFiles] = useState<ClientFile[]>([]);

  useEffect(() => {
    void (async () => {
      const store = await hydrateLiveStore();
      if (!store?.session) return;
      const uid = store.session.userId;
      setDocs(store.documents.filter((d) => d.userId === uid));
      setFiles((store.files || []).filter((f) => f.userId === uid));
    })();
  }, []);

  const pending = docs.filter((d) => d.status === 'sent').length;

  return (
    <PortalChrome requireRole="client" active="documents">
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>My documents</h1>
      <p className="portal-muted" style={{ marginBottom: 22 }}>
        Letter of Engagement and Contract for Tax Returns from Tax for Taxi Drivers Ltd.
        {pending > 0 ? ` ${pending} awaiting your signature.` : ''}
      </p>

      <section className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="portal-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="portal-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Status</th>
                <th>Sent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr>
                  <td colSpan={4} className="portal-muted">
                    No engagement documents yet. Your accountant will send them when your account is set up.
                  </td>
                </tr>
              )}
              {docs.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 700 }}>{d.title}</td>
                  <td>{d.status === 'signed' ? 'Signed' : 'Ready to sign'}</td>
                  <td>{formatDate(d.sentAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {d.status === 'sent' ? (
                      <a className="btn btn-y" href={`/portal/client/documents/sign?id=${d.id}`}>
                        Sign
                      </a>
                    ) : d.signedDocumentHtml ? (
                      <a
                        className="btn btn-ghost"
                        href={`data:text/html;charset=utf-8,${encodeURIComponent(d.signedDocumentHtml)}`}
                        download={`${d.title.replace(/\s+/g, '-').toLowerCase()}-signed.html`}
                      >
                        Download
                      </a>
                    ) : (
                      <span className="portal-muted">Signed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-card" style={{ padding: 0, overflow: 'hidden', marginTop: 22 }}>
        <div style={{ padding: '16px 22px' }}>
          <h2 style={{ fontSize: 18 }}>Files from your accountant</h2>
        </div>
        <div className="portal-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="portal-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Note</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 && (
                <tr>
                  <td colSpan={4} className="portal-muted">
                    No extra files yet.
                  </td>
                </tr>
              )}
              {files.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 700 }}>{f.name}</td>
                  <td>{f.note || '—'}</td>
                  <td>{formatDate(f.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="engagement-doc-actions">
                      <a className="btn btn-ghost btn-compact" href={f.dataUrl} target="_blank" rel="noreferrer">
                        View
                      </a>
                      <a className="btn btn-y btn-compact" href={f.dataUrl} download={f.name}>
                        Download
                      </a>
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
