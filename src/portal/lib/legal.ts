/** Signing agreements shown in the portal — aligned with TFTD paper packs (Oct 2026). */

export const PRIVACY_POLICY = `Tax for Taxi Drivers Ltd processes your personal and financial information to prepare Self Assessment and Making Tax Digital submissions and related accountancy services.

We store your data securely, scoped to your account only, and do not share it with other clients. You may request a copy of your records or ask us to correct inaccuracies by contacting the office on 02890 132083 or info@taxfortaxidrivers.co.uk.

Records are held in encrypted cloud storage with access limited to authorised staff, in line with UK GDPR.`;

/** Client declaration — mirrors Client Approval Certificate (Tax Return / I&E). */
export const CLIENT_APPROVAL_DECLARATION = `I approve this Tax Return and Income and Expenditure Account.

I have provided honest and accurate information for the preparation of this Tax Return and Income and Expenditure Account.

I confirm that I have made available to the best of my knowledge all relevant records and information for their preparation.

I authorise and instruct Tax for Taxi Drivers Ltd to submit this Tax Return and Income and Expenditure Account to HMRC on my behalf.`;

/** Short single-paragraph form used in PDF audit blocks and checkboxes. */
export const DECLARATION_TEXT = CLIENT_APPROVAL_DECLARATION.replace(/\n+/g, ' ').trim();

export const TERMS_CONDITIONS = `By signing electronically you confirm that:

• You approve the Tax Return and Income and Expenditure figures shown as correct and complete to the best of your knowledge and belief.
• You have provided honest and accurate information and made available all relevant records for their preparation.
• You authorise and instruct Tax for Taxi Drivers Ltd to submit this Tax Return and Income and Expenditure Account to HMRC on your behalf.
• You understand this electronic signature is legally equivalent to a handwritten signature when accompanied by a verified audit trail.
• You have read and accept our privacy policy.`;

/** Admin counter-sign — mirrors firm section of Client Approval Certificate. */
export const ADMIN_COUNTER_SIGN_TERMS = `By counter-signing you confirm that:

• The client has received a copy of the information contained in this Tax Return and Income and Expenditure Account.
• The client has approved the information as being correct and complete to the best of their knowledge and belief.
• The client has instructed Tax for Taxi Drivers Ltd to submit this Tax Return and Income and Expenditure Account to HMRC, and you approve proceeding accordingly.
• Your signature completes the two-party Client Approval Certificate and locks this document.`;
