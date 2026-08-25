import type { SignatureRecord, Submission, User } from './types';
import { DECLARATION_TEXT } from './types';
import {
  formatDate,
  formatMoney,
  lineTotal,
  monthExpenseTotal,
  monthProfit,
  totalExpenditure,
  totalIncome,
  totalProfit,
  tradeLabel,
} from './calc';

export function buildSignedDocumentHtml(opts: {
  submission: Submission;
  client: User;
  clientSignature: SignatureRecord;
  adminSignature: SignatureRecord;
}) {
  const { submission: sub, client, clientSignature, adminSignature } = opts;
  const monthHeaders = sub.months.map((m) => `<th class="num">${escapeHtml(m.label)}</th>`).join('');

  const rows = sub.lines
    .map((line) => {
      const cells = sub.months
        .map((m) => `<td class="num">${formatMoney(line.values[m.id] || 0)}</td>`)
        .join('');
      return `<tr>
        <td>${escapeHtml(line.category)}${line.custom ? ' <em>(custom)</em>' : ''}</td>
        ${cells}
        <td class="num">${formatMoney(lineTotal(line, sub.months))}</td>
      </tr>`;
    })
    .join('');

  const expTotals = sub.months.map((m) => `<th class="num">${formatMoney(monthExpenseTotal(sub.lines, m.id))}</th>`).join('');
  const incomeCells = sub.months.map((m) => `<td class="num">${formatMoney(sub.income[m.id] || 0)}</td>`).join('');
  const profitCells = sub.months.map((m) => `<td class="num">${formatMoney(monthProfit(sub, sub.lines, m.id))}</td>`).join('');

  const uploadedDoc = sub.signDocument
    ? `<div class="attach"><strong>Attached document:</strong> ${escapeHtml(sub.signDocument.name)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8" />
<title>Signed MTD declaration — ${escapeHtml(sub.periodLabel)}</title>
<style>
  @media print { body { margin: 0; } .no-print { display: none; } }
  body { font-family: Georgia, serif; color: #141310; max-width: 860px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .meta { color: #57544c; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 18px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
  th { background: #f1efe6; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .banner { background: #fff3cc; border: 1px solid #f3e4a8; padding: 10px 14px; border-radius: 8px; font-size: 12px; margin-bottom: 20px; }
  .decl { border-left: 3px solid #ffc400; padding: 12px 16px; background: #fbfaf5; margin: 20px 0; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 28px 0; }
  .sig-box { border: 1px solid #ddd; border-radius: 10px; padding: 14px; background: #fff; }
  .sig-box h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px; color: #57544c; }
  .sig-box img { max-width: 100%; height: 72px; object-fit: contain; display: block; margin: 8px 0; }
  .audit { background: #141310; color: #fbfaf5; padding: 18px; border-radius: 10px; font-size: 11px; margin-top: 28px; }
  .audit h2 { color: #ffc400; font-size: 13px; margin: 0 0 10px; letter-spacing: 0.08em; text-transform: uppercase; }
  .audit code { word-break: break-all; color: #ffc400; }
  .locked { border: 2px solid #1d6b36; padding: 8px 12px; border-radius: 8px; color: #1d6b36; font-weight: 700; font-size: 12px; display: inline-block; margin-bottom: 16px; }
  .attach { font-size: 13px; margin: 12px 0; padding: 10px; background: #f1efe6; border-radius: 8px; }
</style>
</head>
<body>
  <div class="banner no-print"><strong>DEMO DOCUMENT</strong> — Use your browser Print → Save as PDF for a PDF copy.</div>
  <div class="locked">🔒 LOCKED — Fully signed &amp; counter-signed</div>
  <h1>Making Tax Digital — signed declaration</h1>
  <p class="meta">
    ${escapeHtml(client.fullName)} · ${escapeHtml(client.email)} · ${tradeLabel(sub.tradeType)}<br/>
    Period: <strong>${escapeHtml(sub.periodLabel)}</strong> · Completed ${formatDate(adminSignature.signedAt)}
  </p>
  ${uploadedDoc}

  <h2 style="font-size:16px">Income &amp; expenditure</h2>
  <table>
    <thead>
      <tr>
        <th>Expenditure</th>
        ${monthHeaders}
        <th class="num">Totals</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr>
        <th>Totals</th>
        ${expTotals}
        <th class="num">${formatMoney(totalExpenditure(sub.lines, sub.months))}</th>
      </tr>
      <tr>
        <th>Income</th>
        ${incomeCells}
        <td class="num">${formatMoney(totalIncome(sub))}</td>
      </tr>
      <tr>
        <th>Profit</th>
        ${profitCells}
        <td class="num">${formatMoney(totalProfit(sub, sub.lines))}</td>
      </tr>
    </tbody>
  </table>

  <div class="decl"><p>${escapeHtml(DECLARATION_TEXT)}</p></div>

  <div class="sig-grid">
    <div class="sig-box">
      <h3>Client signature</h3>
      <img src="${clientSignature.signatureImageDataUrl}" alt="Client signature" />
      <p><strong>${escapeHtml(clientSignature.signerName)}</strong><br/>
      ${escapeHtml(clientSignature.signerEmail)}<br/>
      ${escapeHtml(formatDate(clientSignature.signedAt))}</p>
    </div>
    <div class="sig-box">
      <h3>Accountant counter-signature</h3>
      <img src="${adminSignature.signatureImageDataUrl}" alt="Admin signature" />
      <p><strong>${escapeHtml(adminSignature.signerName)}</strong><br/>
      ${escapeHtml(adminSignature.signerEmail)}<br/>
      ${escapeHtml(formatDate(adminSignature.signedAt))}</p>
    </div>
  </div>

  <div class="audit">
    <h2>Audit trail</h2>
    <p><strong>Client OTP verified:</strong> ${clientSignature.otpVerified ? 'Yes' : 'No'} · IP ${escapeHtml(clientSignature.ipAddress)}</p>
    <p><strong>Admin OTP verified:</strong> ${adminSignature.otpVerified ? 'Yes' : 'No'} · IP ${escapeHtml(adminSignature.ipAddress)}</p>
    <p><strong>Document hash (SHA-256):</strong><br/><code>${escapeHtml(adminSignature.documentHash)}</code></p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function downloadLockedDocument(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function printLockedDocument(html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
