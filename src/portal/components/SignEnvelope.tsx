import { useMemo, useState } from 'react';
import PortalChrome from './PortalChrome';
import SignaturePad from './SignaturePad';
import StatusBadge from './StatusBadge';
import { ADMIN_COUNTER_SIGN_TERMS, PRIVACY_POLICY, TERMS_CONDITIONS } from '../lib/legal';
import {
  formatMoney,
  lineTotal,
  monthExpenseTotal,
  monthProfit,
  sha256,
  totalExpenditure,
  totalIncome,
  totalProfit,
} from '../lib/calc';
import { buildSignedDocumentHtml, downloadLockedDocument, printLockedDocument } from '../lib/pdf';
import { loadStore, persistSubmissionLive } from '../lib/store';
import type { SignatureRecord, Submission } from '../lib/types';
import { DECLARATION_TEXT } from '../lib/types';

function getId() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

type Step = 'document' | 'terms' | 'sign' | 'done';

interface Props {
  mode: 'client' | 'admin';
}

export default function SignEnvelope({ mode }: Props) {
  const id = useMemo(() => (typeof window !== 'undefined' ? getId() : ''), []);
  const store = loadStore();
  const session = store.session;
  const submission = store.submissions.find((s) => s.id === id);
  const client = store.users.find((u) => u.id === submission?.userId);

  const [step, setStep] = useState<Step>('document');
  const [termsOk, setTermsOk] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [sigData, setSigData] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(submission?.signDocument?.dataUrl || null);
  const [uploadName, setUploadName] = useState(submission?.signDocument?.name || '');
  const [error, setError] = useState('');
  const [finalHash, setFinalHash] = useState('');
  const [busy, setBusy] = useState(false);

  const requireRole = mode === 'admin' ? 'admin' : 'client';
  const active = mode === 'admin' ? 'admin' : 'client';

  if (!session) {
    return (
      <PortalChrome requireRole={requireRole} active={active}>
        <p className="portal-muted">Loading…</p>
      </PortalChrome>
    );
  }

  if (!submission || !client) {
    return (
      <PortalChrome requireRole={requireRole} active={active}>
        <div className="portal-alert portal-alert-error">Submission not found.</div>
      </PortalChrome>
    );
  }

  if (mode === 'client' && submission.userId !== session.userId) {
    return (
      <PortalChrome requireRole="client" active="client">
        <div className="portal-alert portal-alert-error">You cannot sign this submission.</div>
      </PortalChrome>
    );
  }

  if (submission.status === 'signed') {
    return (
      <PortalChrome requireRole={requireRole} active={active}>
        <DoneView submission={submission} hash={submission.adminSignature?.documentHash || ''} />
      </PortalChrome>
    );
  }

  if (mode === 'client' && submission.status !== 'ready_to_sign') {
    return (
      <PortalChrome requireRole="client" active="client">
        <div className="portal-alert portal-alert-info">
          Not ready to sign yet. Status: <StatusBadge status={submission.status} />
          {submission.status === 'client_signed' && ' - waiting for accountant counter-signature.'}
        </div>
      </PortalChrome>
    );
  }

  if (mode === 'admin' && submission.status !== 'client_signed') {
    return (
      <PortalChrome requireRole="admin" active="admin">
        <div className="portal-alert portal-alert-info">
          Counter-sign is available once the client has signed. Current status: <StatusBadge status={submission.status} />
        </div>
        <a className="btn btn-ghost" href={`/portal/admin/submission?id=${submission.id}`}>Review submission</a>
      </PortalChrome>
    );
  }

  const steps: { key: Step; label: string }[] =
    mode === 'client'
      ? [
          { key: 'document', label: 'Review' },
          { key: 'terms', label: 'Terms' },
          { key: 'sign', label: 'Sign' },
        ]
      : [
          { key: 'document', label: 'Review' },
          { key: 'terms', label: 'Approve' },
          { key: 'sign', label: 'Counter-sign' },
        ];

  function onUpload(file: File | null) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setError('Keep uploads under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        const dataUrl = String(reader.result);
        setUploadPreview(dataUrl);
        setUploadName(file.name);
        const updated: Submission = {
          ...submission,
          signDocument: { name: file.name, dataUrl, mimeType: file.type || 'application/octet-stream' },
          updatedAt: new Date().toISOString(),
        };
        const saved = await persistSubmissionLive(updated);
        if (!saved) {
          setError('Could not save the uploaded document.');
          return;
        }
        setError('');
      })();
    };
    reader.readAsDataURL(file);
  }

  async function applySignature() {
    const needsTerms = mode === 'client' ? termsOk && privacyOk : termsOk;
    if (!needsTerms) {
      setError('Please accept all required agreements.');
      return;
    }
    if (!sigData) {
      setError('Please draw your signature first.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const signedAt = new Date().toISOString();
      const sig: SignatureRecord = {
        signerName: session.fullName,
        signerEmail: session.email,
        signedAt,
        ipAddress: 'authenticated-session',
        otpVerified: true,
        documentHash: '',
        signatureImageDataUrl: sigData,
        termsAccepted: termsOk,
        privacyAccepted: mode === 'client' ? privacyOk : true,
        role: mode,
      };

      const current = loadStore();
      const sub = current.submissions.find((x) => x.id === submission.id);
      if (!sub) {
        setError('Submission not found.');
        return;
      }

      if (mode === 'client') {
        sig.documentHash = await sha256(JSON.stringify({ submissionId: submission.id, sig, figures: submission.lines }));
        const updated: Submission = {
          ...sub,
          status: 'client_signed',
          clientSignature: sig,
          updatedAt: signedAt,
        };
        const saved = await persistSubmissionLive(updated);
        if (!saved) {
          setError('Could not save signature. Try again.');
          return;
        }
        setFinalHash(sig.documentHash);
        setStep('done');
        return;
      }

      sig.documentHash = await sha256(
        JSON.stringify({
          submissionId: submission.id,
          clientSig: sub.clientSignature,
          adminSig: sig,
          figures: sub.lines,
        })
      );
      const html = buildSignedDocumentHtml({
        submission: { ...sub, status: 'signed', signedAt, adminSignature: sig },
        client,
        clientSignature: sub.clientSignature!,
        adminSignature: sig,
      });
      const updated: Submission = {
        ...sub,
        status: 'signed',
        adminSignature: sig,
        signedAt,
        signedDocumentHtml: html,
        updatedAt: signedAt,
      };
      const saved = await persistSubmissionLive(updated);
      if (!saved) {
        setError('Could not save counter-signature. Try again.');
        return;
      }
      setFinalHash(sig.documentHash);
      setStep('done');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalChrome requireRole={requireRole} active={active}>
      <div className="sign-envelope">
        <aside className="sign-sidebar">
          <p className="sign-sidebar-label">Sign document</p>
          <h1>{mode === 'client' ? 'Sign your declaration' : 'Counter-sign & approve'}</h1>
          <p className="portal-muted">{submission.periodLabel} · {client.fullName}</p>
          <ol className="sign-steps">
            {steps.map((s, i) => (
              <li key={s.key} className={step === s.key ? 'active' : steps.findIndex((x) => x.key === step) > i ? 'done' : ''}>
                <span className="sign-step-n">{i + 1}</span>
                {s.label}
              </li>
            ))}
          </ol>
          {mode === 'admin' && submission.clientSignature && (
            <div className="sign-client-preview">
              <p className="sign-sidebar-label">Client signed</p>
              <img src={submission.clientSignature.signatureImageDataUrl} alt="Client signature" />
            </div>
          )}
        </aside>

        <div className="sign-main">
          {error && <div className="portal-alert portal-alert-error">{error}</div>}

          {step === 'document' && (
            <>
              <div className="sign-doc-toolbar">
                <StatusBadge status={submission.status} />
                {mode === 'client' && (
                  <label className="btn btn-ghost sign-upload-btn">
                    Upload document
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" hidden onChange={(e) => onUpload(e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>
              <div className="sign-doc-viewer">
                {uploadPreview && (
                  <div className="sign-doc-attachment">
                    <p className="sign-sidebar-label">Attached: {uploadName}</p>
                    {uploadPreview.startsWith('data:image') ? (
                      <img src={uploadPreview} alt="Uploaded document" className="sign-doc-img" />
                    ) : (
                      <p className="portal-muted">PDF attached: {uploadName} (preview in production)</p>
                    )}
                  </div>
                )}
                <h2>Income &amp; expenditure summary</h2>
                <table className="portal-table sign-summary-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      {submission.months.map((m) => (
                        <th key={m.id} className="num">{m.label}</th>
                      ))}
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submission.lines.slice(0, 6).map((line) => (
                      <tr key={line.id}>
                        <td>{line.category}</td>
                        {submission.months.map((m) => (
                          <td key={m.id} className="num">{formatMoney(line.values[m.id] || 0)}</td>
                        ))}
                        <td className="num">{formatMoney(lineTotal(line, submission.months))}</td>
                      </tr>
                    ))}
                    <tr>
                      <th>Profit</th>
                      {submission.months.map((m) => (
                        <td key={m.id} className="num">{formatMoney(monthProfit(submission, submission.lines, m.id))}</td>
                      ))}
                      <td className="num">{formatMoney(totalProfit(submission, submission.lines))}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="portal-muted sign-totals">
                  Total income {formatMoney(totalIncome(submission))} · Total expenditure {formatMoney(totalExpenditure(submission.lines, submission.months))}
                </p>
                <div className="sign-field-placeholder">
                  <span className="sign-field-tag">Signature required</span>
                  <div className="sign-field-box">{mode === 'client' ? 'Your signature' : 'Accountant counter-signature'}</div>
                </div>
              </div>
              <div className="portal-actions">
                <a className="btn btn-ghost" href={mode === 'client' ? `/portal/client/submission?id=${id}` : `/portal/admin/submission?id=${id}`}>Back</a>
                <button type="button" className="btn btn-y" onClick={() => setStep('terms')}>Continue</button>
              </div>
            </>
          )}

          {step === 'terms' && (
            <>
              <div className="sign-legal">
                <span className="placeholder-flag">Please read carefully before signing</span>
                {mode === 'client' ? (
                  <>
                    <section>
                      <h2>Privacy policy</h2>
                      <p>{PRIVACY_POLICY}</p>
                      <label className="sign-check">
                        <input type="checkbox" checked={privacyOk} onChange={(e) => setPrivacyOk(e.target.checked)} />
                        I have read and accept the privacy policy
                      </label>
                    </section>
                    <section>
                      <h2>Terms &amp; declaration</h2>
                      <p>{TERMS_CONDITIONS}</p>
                      <blockquote>{DECLARATION_TEXT}</blockquote>
                      <label className="sign-check">
                        <input type="checkbox" checked={termsOk} onChange={(e) => setTermsOk(e.target.checked)} />
                        I agree to the terms and confirm the figures are accurate
                      </label>
                    </section>
                  </>
                ) : (
                  <section>
                    <h2>Accountant approval</h2>
                    <p>{ADMIN_COUNTER_SIGN_TERMS}</p>
                    <label className="sign-check">
                      <input type="checkbox" checked={termsOk} onChange={(e) => setTermsOk(e.target.checked)} />
                      I approve this submission and am ready to counter-sign
                    </label>
                  </section>
                )}
              </div>
              <div className="portal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setStep('document')}>Back</button>
                <button
                  type="button"
                  className="btn btn-y"
                  onClick={() => setStep('sign')}
                  disabled={mode === 'client' ? !(termsOk && privacyOk) : !termsOk}
                >
                  Continue to sign
                </button>
              </div>
            </>
          )}

          {step === 'sign' && (
            <>
              <SignaturePad
                label={mode === 'client' ? 'Draw your signature' : 'Draw counter-signature'}
                onChange={setSigData}
              />
              <div className="portal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setStep('terms')}>Back</button>
                <button type="button" className="btn btn-y" onClick={() => void applySignature()} disabled={!sigData || busy}>
                  {busy ? 'Saving…' : mode === 'client' ? 'Apply signature' : 'Lock & approve'}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <DoneView submission={loadStore().submissions.find((s) => s.id === id)!} hash={finalHash} mode={mode} />
          )}
        </div>
      </div>
    </PortalChrome>
  );
}

function DoneView({ submission, hash, mode }: { submission: Submission; hash: string; mode?: 'client' | 'admin' }) {
  const isFinal = submission.status === 'signed';

  return (
    <div className="portal-card sign-done">
      <div className="portal-alert portal-alert-success">
        {isFinal
          ? 'Document fully signed and locked. Download or print to PDF.'
          : 'Your signature is applied. Waiting for accountant counter-signature.'}
      </div>
      {hash && <p className="portal-muted">Hash: <code style={{ wordBreak: 'break-all' }}>{hash}</code></p>}
      <div className="portal-actions">
        {isFinal && submission.signedDocumentHtml && (
          <>
            <button
              type="button"
              className="btn btn-y"
              onClick={() => downloadLockedDocument(submission.signedDocumentHtml!, `signed-${submission.id}.html`)}
            >
              Download document
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => printLockedDocument(submission.signedDocumentHtml!)}>
              Print / Save as PDF
            </button>
          </>
        )}
        <a className="btn btn-ghost" href={mode === 'admin' || !mode ? '/portal/admin' : '/portal/client'}>
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
