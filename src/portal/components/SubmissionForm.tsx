import { useMemo, useState } from 'react';
import type { ExpenseLine, PeriodMonth, Submission, TradeType } from '../lib/types';
import {
  defaultLines,
  formatMoney,
  isEditableStatus,
  lineTotal,
  monthExpenseTotal,
  monthProfit,
  totalExpenditure,
  totalIncome,
  totalProfit,
  uid,
} from '../lib/calc';
import { monthsFromPeriodLabel, nextMonthLabel, periodLabelFromMonths } from '../lib/months';
import { loadStore, persistSubmissionLive } from '../lib/store';

interface Props {
  mode: 'create' | 'edit';
  submissionId?: string;
  /** Admin can edit any non-signed submission */
  adminEdit?: boolean;
  /** Force read-only (admin review view) */
  viewOnly?: boolean;
  backHref?: string;
}

export default function SubmissionForm({ mode, submissionId, adminEdit = false, viewOnly = false, backHref }: Props) {
  const store = loadStore();
  const session = store.session;
  const existing = submissionId ? store.submissions.find((s) => s.id === submissionId) : undefined;
  const trade: TradeType = existing?.tradeType || session?.tradeType || 'taxi';

  const initialMonths = existing?.months || monthsFromPeriodLabel('Apr to Jun 2026');

  const [periodLabel, setPeriodLabel] = useState(existing?.periodLabel || 'Apr to Jun 2026');
  const [months, setMonths] = useState<PeriodMonth[]>(initialMonths);
  const [income, setIncome] = useState<Record<string, number>>(existing?.income || {});
  const [lines, setLines] = useState<ExpenseLine[]>(existing?.lines || defaultLines(trade, initialMonths));
  const [files, setFiles] = useState(existing?.files || []);
  const [message, setMessage] = useState('');
  const [customName, setCustomName] = useState('');

  const editable = viewOnly
    ? false
    : adminEdit
      ? isEditableStatus(existing?.status || 'draft', true)
      : isEditableStatus(existing?.status || 'draft', false);

  const lockedForClient =
    !adminEdit &&
    (existing?.status === 'ready_to_sign' ||
      existing?.status === 'client_signed' ||
      existing?.status === 'signed');

  const readOnly = !editable || (lockedForClient && !adminEdit);

  const totals = useMemo(() => {
    const sub = { income, months };
    const byMonth = months.map((m) => ({
      id: m.id,
      exp: monthExpenseTotal(lines, m.id),
      profit: monthProfit(sub, lines, m.id),
      inc: income[m.id] || 0,
    }));
    return {
      byMonth,
      expAll: totalExpenditure(lines, months),
      incAll: totalIncome(sub),
      profitAll: totalProfit(sub, lines),
    };
  }, [lines, income, months]);

  if (!session) {
    return <div className="portal-muted">Loading…</div>;
  }

  if (existing && existing.userId !== session.userId && session.role !== 'admin') {
    return <div className="portal-alert portal-alert-error">You cannot open this submission.</div>;
  }

  function setLineValue(lineId: string, monthId: string, value: string) {
    const n = Number(value);
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, values: { ...line.values, [monthId]: Number.isFinite(n) ? n : 0 } } : line
      )
    );
  }

  function setIncomeValue(monthId: string, value: string) {
    const n = Number(value);
    setIncome((prev) => ({ ...prev, [monthId]: Number.isFinite(n) ? n : 0 }));
  }

  function addCustomLine() {
    const name = customName.trim();
    if (!name) return;
    const values = Object.fromEntries(months.map((m) => [m.id, 0]));
    setLines((prev) => [...prev, { id: uid('line'), category: name, values, custom: true }]);
    setCustomName('');
  }

  function addMonth() {
    const label = nextMonthLabel(months);
    const month: PeriodMonth = { id: uid('month'), label };
    const nextMonths = [...months, month];
    setMonths(nextMonths);
    setPeriodLabel(periodLabelFromMonths(nextMonths));
    setIncome((prev) => ({ ...prev, [month.id]: 0 }));
    setLines((prev) => prev.map((line) => ({ ...line, values: { ...line.values, [month.id]: 0 } })));
  }

  function removeMonth(monthId: string) {
    if (months.length <= 1) return;
    const nextMonths = months.filter((m) => m.id !== monthId);
    setMonths(nextMonths);
    setPeriodLabel(periodLabelFromMonths(nextMonths));
    setIncome((prev) => {
      const copy = { ...prev };
      delete copy[monthId];
      return copy;
    });
    setLines((prev) =>
      prev.map((line) => {
        const values = { ...line.values };
        delete values[monthId];
        return { ...line, values };
      })
    );
  }

  function onFilePick(fileList: FileList | null) {
    if (!fileList?.length) return;
    const added = Array.from(fileList).map((f) => ({
      id: uid('file'),
      name: f.name,
      sizeLabel: f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`,
      uploadedAt: new Date().toISOString(),
    }));
    setFiles((prev) => [...prev, ...added]);
  }

  async function persist(status: Submission['status']) {
    if (!session) {
      setMessage('You need to be signed in.');
      return;
    }
    if (!editable && status !== existing?.status) {
      setMessage('This submission is locked. Only admin can edit signed records.');
      return;
    }
    const now = new Date().toISOString();
    const label = periodLabelFromMonths(months);

    const base: Submission =
      mode === 'create'
        ? {
            id: crypto.randomUUID(),
            userId: session.userId,
            periodLabel: label,
            tradeType: trade,
            status,
            months,
            income,
            lines,
            files,
            createdAt: now,
            updatedAt: now,
          }
        : {
            ...(existing as Submission),
            periodLabel: label,
            months,
            income,
            lines,
            files,
            status: editable ? status : existing!.status,
            updatedAt: now,
          };

    const saved = await persistSubmissionLive(base);
    if (!saved) {
      setMessage('Could not save submission. Try again.');
      return;
    }
    setMessage(status === 'submitted' ? 'Submitted.' : 'Saved.');
    window.location.href = adminEdit
      ? `/portal/admin/submission?id=${saved.id}`
      : `/portal/client/submission?id=${saved.id}`;
  }

  const back = backHref || (adminEdit ? '/portal/admin' : '/portal/client');

  return (
    <div className="portal-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>{mode === 'create' ? 'New submission' : periodLabel}</h1>
          <p className="portal-muted" style={{ marginTop: 6 }}>
            {adminEdit && <strong>Admin edit · </strong>}
            Named months match your reporting period (typically quarterly for MTD). Totals and profit update live.
          </p>
        </div>
        {existing && (
          <a className="btn btn-ghost" href={back}>
            Back
          </a>
        )}
      </div>

      {message && <div className="portal-alert portal-alert-success">{message}</div>}

      {lockedForClient && (
        <div className="portal-alert portal-alert-info">
          Figures locked for signing.
          {existing?.status === 'ready_to_sign' && (
            <>
              {' '}
              <a href={`/portal/client/sign?id=${existing.id}`} style={{ fontWeight: 800, borderBottom: '1.5px solid var(--yellow-deep)' }}>
                Open signing
              </a>
            </>
          )}
          {existing?.status === 'client_signed' && ' Waiting for accountant counter-signature.'}
        </div>
      )}

      {!readOnly && (
        <div className="portal-actions" style={{ marginBottom: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={addMonth}>
            + Add month
          </button>
          <span className="portal-muted" style={{ fontSize: 13 }}>
            Most clients file quarterly (3 months). Add months if needed.
          </span>
        </div>
      )}

      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Expenditure</th>
              {months.map((m) => (
                <th key={m.id} className="num">
                  {m.label}
                  {!readOnly && months.length > 1 && (
                    <button type="button" className="month-remove" onClick={() => removeMonth(m.id)} aria-label={`Remove ${m.label}`}>
                      ×
                    </button>
                  )}
                </th>
              ))}
              <th className="num">Totals</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>
                  {line.category}
                  {line.custom ? ' (custom)' : ''}
                </td>
                {months.map((m) => (
                  <td className="num" key={m.id}>
                    {readOnly ? (
                      formatMoney(line.values[m.id] || 0)
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.values[m.id] || 0}
                        onChange={(e) => setLineValue(line.id, m.id, e.target.value)}
                      />
                    )}
                  </td>
                ))}
                <td className="num">{formatMoney(lineTotal(line, months))}</td>
              </tr>
            ))}
            <tr>
              <th>Totals</th>
              {totals.byMonth.map((m) => (
                <th key={m.id} className="num">
                  {formatMoney(m.exp)}
                </th>
              ))}
              <th className="num">{formatMoney(totals.expAll)}</th>
            </tr>
            <tr>
              <th>Income</th>
              {months.map((m) => (
                <td className="num" key={m.id}>
                  {readOnly ? (
                    formatMoney(income[m.id] || 0)
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={income[m.id] || 0}
                      onChange={(e) => setIncomeValue(m.id, e.target.value)}
                    />
                  )}
                </td>
              ))}
              <td className="num">{formatMoney(totals.incAll)}</td>
            </tr>
            <tr>
              <th>Profit</th>
              {totals.byMonth.map((m) => (
                <td key={m.id} className="num">
                  {formatMoney(m.profit)}
                </td>
              ))}
              <td className="num">{formatMoney(totals.profitAll)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="portal-actions" style={{ marginTop: 16 }}>
          <input
            type="text"
            placeholder="Custom expenditure line"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            style={{ maxWidth: 260, border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', fontWeight: 600 }}
          />
          <button type="button" className="btn btn-ghost" onClick={addCustomLine}>
            Add line
          </button>
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Supporting files</h2>
        <p className="portal-muted" style={{ marginBottom: 10 }}>
          Supporting files are attached to this submission.
        </p>
        {!readOnly && <input type="file" multiple onChange={(e) => onFilePick(e.target.files)} />}
        <ul style={{ marginTop: 12, paddingLeft: 18 }}>
          {files.length === 0 && <li className="portal-muted">No files attached.</li>}
          {files.map((f) => (
            <li key={f.id} style={{ fontWeight: 600, marginBottom: 4 }}>
              {f.name} <span className="portal-muted">({f.sizeLabel})</span>
            </li>
          ))}
        </ul>
      </div>

      {!readOnly && (
        <div className="portal-actions" style={{ marginTop: 24 }}>
          {adminEdit ? (
            <button type="button" className="btn btn-y" onClick={() => persist(existing?.status || 'submitted')}>
              Save changes
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => persist('draft')}>
                Save draft
              </button>
              <button type="button" className="btn btn-y" onClick={() => persist('submitted')}>
                Submit for review
              </button>
            </>
          )}
        </div>
      )}

      {existing?.status === 'signed' && existing.signedDocumentHtml && (
        <div className="portal-actions" style={{ marginTop: 24 }}>
          <a
            className="btn btn-y"
            href={`data:text/html;charset=utf-8,${encodeURIComponent(existing.signedDocumentHtml)}`}
            download={`signed-${existing.id}.html`}
          >
            Download signed document
          </a>
        </div>
      )}
    </div>
  );
}
