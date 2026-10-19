/** HTML templates from TFTD Letter of Engagement + Contract (Oct 2026 packs). */

export type OnboardingDocType = 'letter_of_engagement' | 'contract_tax_returns';

export function letterOfEngagementHtml(clientName: string): string {
  return `
    <p><strong>Tax for Taxi Drivers Ltd</strong><br/>
    Accounting, Bookkeeping and Tax Services<br/>
    Unit 4, North City Business Centre, Belfast BT15 2GG</p>
    <p>Dear ${escape(clientName)},</p>
    <p>The purpose of this engagement letter is to set out the basis upon which you have instructed T.F.T.D. Ltd in connection with your Tax Return(s).</p>
    <h3>Accountancy services</h3>
    <ul>
      <li>T.F.T.D. Ltd agrees to prepare and finalise your Accounts and Tax Returns from your Accounting Records and the information supplied by you.</li>
      <li>T.F.T.D. Ltd will examine your records and make the necessary enquiries to prepare your Accounts and Tax Return but will not perform an Audit.</li>
    </ul>
    <h3>Specific tasks to be performed by the Client — you agree</h3>
    <ul>
      <li>To record all Income and Expenditure and to keep all Receipts for purchases.</li>
      <li>To inform HMRC of any change in circumstances relevant to your status.</li>
      <li>The responsibility for the prevention and detection of irregularities rests with the Client.</li>
      <li>T.F.T.D. Ltd will discuss the Accounts before finalisation and ask you to approve them.</li>
      <li>You agree: “I approve these Accounts and confirm that I have made available all relevant records and information for their preparation and submission. I authorise and instruct T.F.T.D. Ltd to submit them to HMRC on my behalf.”</li>
    </ul>
    <p><em>(T.F.T.D. Ltd refers to Tax for Taxi Drivers Limited — an Accountancy Service Provider.)</em></p>
  `;
}

export function contractTaxReturnsHtml(clientName: string, feeAmount?: string): string {
  const fee = feeAmount?.trim() ? escape(feeAmount.trim()) : '……';
  return `
    <p><strong>Tax for Taxi Drivers Ltd</strong><br/>
    Contract for Services — Annual Tax Return</p>
    <p>Client: <strong>${escape(clientName)}</strong></p>
    <ul>
      <li>I agree to pay T.F.T.D. Ltd to prepare and submit my Annual Tax Return.</li>
      <li>The cost of this service is <strong>£${fee}</strong> for each Tax Year.</li>
      <li>The service is paid for by monthly Direct Debit and any balance in cash.</li>
      <li>The contract is for a minimum of one Tax Return.</li>
      <li>This contract renews annually unless terminated with one month’s notice in writing.</li>
      <li>The Tax Return is not submitted until payment in full has been made.</li>
      <li>The Tax Return is based on the information supplied by me (the Client).</li>
      <li>It is my responsibility to inform HMRC of any changes in my circumstances.</li>
      <li>It is my responsibility to maintain records to verify my income and expenditure.</li>
      <li>T.F.T.D. Ltd is not liable for errors or omissions in information supplied by its clients.</li>
      <li>T.F.T.D. Ltd is not liable for any penalties due to late submissions of Tax Returns.</li>
      <li>T.F.T.D. Ltd retains all work in respect of Tax Returns until final payment is made.</li>
    </ul>
    <p><em>(T.F.T.D. Ltd refers to Tax for Taxi Drivers Limited — an Accountancy Service Provider.)</em></p>
  `;
}

export function onboardingDocTitle(type: OnboardingDocType): string {
  return type === 'letter_of_engagement'
    ? 'Letter of Engagement'
    : 'Contract for Tax Returns';
}

export function buildOnboardingBody(type: OnboardingDocType, clientName: string, feeAmount?: string): string {
  return type === 'letter_of_engagement'
    ? letterOfEngagementHtml(clientName)
    : contractTaxReturnsHtml(clientName, feeAmount);
}

export function buildSignedOnboardingHtml(opts: {
  title: string;
  bodyHtml: string;
  clientName: string;
  clientEmail: string;
  signatureDataUrl: string;
  signedAt: string;
  documentHash: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8" />
<title>${escape(opts.title)} — signed</title>
<style>
  body { font-family: Georgia, serif; color: #141310; max-width: 720px; margin: 40px auto; padding: 0 24px; line-height: 1.55; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .meta { color: #57544c; font-size: 13px; margin-bottom: 24px; }
  .locked { border: 2px solid #1d6b36; padding: 8px 12px; border-radius: 8px; color: #1d6b36; font-weight: 700; font-size: 12px; display: inline-block; margin-bottom: 16px; }
  .body { margin: 20px 0; }
  .sig-box { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin-top: 28px; }
  .sig-box img { max-width: 100%; height: 72px; object-fit: contain; display: block; margin: 8px 0; }
  .audit { background: #141310; color: #fbfaf5; padding: 18px; border-radius: 10px; font-size: 11px; margin-top: 28px; }
  .audit code { word-break: break-all; color: #ffc400; }
</style>
</head>
<body>
  <div class="locked">LOCKED — Electronically signed</div>
  <h1>${escape(opts.title)}</h1>
  <p class="meta">${escape(opts.clientName)} · ${escape(opts.clientEmail)} · Signed ${escape(opts.signedAt)}</p>
  <div class="body">${opts.bodyHtml}</div>
  <div class="sig-box">
    <strong>Client signature</strong>
    <img src="${opts.signatureDataUrl}" alt="Signature" />
    <p>${escape(opts.clientName)}<br/>${escape(opts.clientEmail)}<br/>${escape(opts.signedAt)}</p>
  </div>
  <div class="audit">
    <strong style="color:#ffc400">AUDIT</strong><br/>
    Document hash: <code>${escape(opts.documentHash)}</code>
  </div>
</body>
</html>`;
}

function escape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
