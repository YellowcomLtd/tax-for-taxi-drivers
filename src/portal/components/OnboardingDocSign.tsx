import { useEffect, useMemo, useState } from 'react';
import PortalChrome from './PortalChrome';
import SignaturePad from './SignaturePad';
import { PRIVACY_POLICY } from '../lib/legal';
import { sha256 } from '../lib/calc';
import { hydrateLiveStore } from '../lib/store';
import type { ClientDocument, SignatureRecord } from '../lib/types';

function getId() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

export default function OnboardingDocSign() {
  const id = useMemo(() => (typeof window !== 'undefined' ? getId() : ''), []);
  const [doc, setDoc] = useState<ClientDocument | null>(null);
  const [ready, setReady] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [sigData, setSigData] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      const store = await hydrateLiveStore();
      const found = store?.documents.find((d) => d.id === id) || null;
      setDoc(found);
      if (found?.status === 'signed') setDone(true);
      setReady(true);
    })();
  }, [id]);

  if (!ready) {
    return (
      <PortalChrome requireRole="client" active="documents">
        <p className="portal-muted">Loading…</p>
      </PortalChrome>
    );
  }

  if (!doc) {
    return (
      <PortalChrome requireRole="client" active="documents">
        <div className="portal-alert portal-alert-error">Document not found.</div>
        <a className="btn btn-ghost" href="/portal/client/documents">
          Back
        </a>
      </PortalChrome>
    );
  }

  async function sign() {
    if (!doc) return;
    if (!privacyOk || !termsOk) {
      setError('Please accept the privacy policy and confirm you agree to this document.');
      return;
    }
    if (!sigData) {
      setError('Please draw your signature.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const store = await hydrateLiveStore();
      const session = store?.session;
      if (!session) {
        setError('Session expired. Sign in again.');
        return;
      }
      const signedAt = new Date().toISOString();
      const documentHash = await sha256(JSON.stringify({ id: doc.id, body: doc.bodyHtml, sigData, signedAt }));
      const clientSignature: SignatureRecord = {
        signerName: session.fullName,
        signerEmail: session.email,
        signedAt,
        ipAddress: 'authenticated-session',
        otpVerified: true,
        documentHash,
        signatureImageDataUrl: sigData,
        termsAccepted: termsOk,
        privacyAccepted: privacyOk,
        role: 'client',
      };
      const res = await fetch('/api/portal/documents', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, clientSignature }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save signature');
        return;
      }
      setDoc(data.document);
      setDone(true);
      await hydrateLiveStore();
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalChrome requireRole="client" active="documents">
      <div className="portal-actions" style={{ marginBottom: 16 }}>
        <a className="btn btn-ghost" href="/portal/client/documents">
          ← All documents
        </a>
      </div>

      <h1 style={{ fontSize: 28, marginBottom: 8 }}>{doc.title}</h1>
      <p className="portal-muted" style={{ marginBottom: 18 }}>
        Tax for Taxi Drivers Ltd · please read carefully before signing
      </p>

      {error && <div className="portal-alert portal-alert-error">{error}</div>}
      {done && (
        <div className="portal-alert portal-alert-success" style={{ marginBottom: 16 }}>
          Document signed. Thank you.
        </div>
      )}

      <section className="portal-card" style={{ marginBottom: 20 }}>
        <div
          className="onboarding-doc-body"
          style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-2)' }}
          dangerouslySetInnerHTML={{ __html: doc.bodyHtml }}
        />
      </section>

      {!done && doc.status === 'sent' && (
        <section className="portal-card">
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Confirm &amp; sign</h2>
          <p style={{ marginBottom: 12, whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>{PRIVACY_POLICY}</p>
          <label style={{ display: 'flex', gap: 10, marginBottom: 12, fontWeight: 600 }}>
            <input type="checkbox" checked={privacyOk} onChange={(e) => setPrivacyOk(e.target.checked)} />
            I have read and accept the privacy policy
          </label>
          <label style={{ display: 'flex', gap: 10, marginBottom: 18, fontWeight: 600 }}>
            <input type="checkbox" checked={termsOk} onChange={(e) => setTermsOk(e.target.checked)} />
            I agree to the terms of this {doc.title} and am ready to sign electronically
          </label>
          <SignaturePad label="Draw your signature" onChange={setSigData} />
          <div className="portal-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-y" disabled={busy} onClick={() => void sign()}>
              {busy ? 'Saving…' : 'Sign document'}
            </button>
          </div>
        </section>
      )}

      {done && doc.signedDocumentHtml && (
        <a
          className="btn btn-ghost"
          href={`data:text/html;charset=utf-8,${encodeURIComponent(doc.signedDocumentHtml)}`}
          download={`${doc.title.replace(/\s+/g, '-').toLowerCase()}-signed.html`}
        >
          Download signed copy
        </a>
      )}
    </PortalChrome>
  );
}
