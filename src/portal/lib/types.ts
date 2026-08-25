export type Role = 'admin' | 'client';
export type TradeType = 'taxi' | 'beautician';

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'ready_to_sign'
  | 'client_signed'
  | 'signed';

export interface User {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: Role;
  tradeType?: TradeType;
}

export interface PeriodMonth {
  id: string;
  label: string;
}

export interface ExpenseLine {
  id: string;
  category: string;
  values: Record<string, number>;
  custom?: boolean;
}

export interface SubmissionFile {
  id: string;
  name: string;
  sizeLabel: string;
  uploadedAt: string;
}

export interface SignDocument {
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface SignatureRecord {
  signerName: string;
  signerEmail: string;
  signedAt: string;
  ipAddress: string;
  otpVerified: boolean;
  documentHash: string;
  signatureImageDataUrl: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  role: 'client' | 'admin';
}

export interface Submission {
  id: string;
  userId: string;
  periodLabel: string;
  tradeType: TradeType;
  status: SubmissionStatus;
  months: PeriodMonth[];
  income: Record<string, number>;
  lines: ExpenseLine[];
  files: SubmissionFile[];
  /** Optional uploaded document to sign alongside figures */
  signDocument?: SignDocument;
  createdAt: string;
  updatedAt: string;
  signedAt?: string;
  clientSignature?: SignatureRecord;
  adminSignature?: SignatureRecord;
  /** Locked final document (demo: print-ready HTML) */
  signedDocumentHtml?: string;
}

export interface EmailCampaign {
  id: string;
  subject: string;
  body: string;
  sentBy: string;
  sentAt: string;
  recipientCount: number;
  recipients: string[];
}

export interface Session {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  tradeType?: TradeType;
  pending2fa?: boolean;
  demoOtp?: string;
}

export interface PortalStore {
  users: User[];
  submissions: Submission[];
  campaigns: EmailCampaign[];
  session: Session | null;
  notices: { id: string; at: string; to: string; subject: string; body: string }[];
}

export const TAXI_CATEGORIES = [
  'Depot Rent',
  'Fuel',
  'Insurance',
  'Taxi Rental/Repayment',
  'Service Costs',
  'Road Tax /PSV/Licencing',
  'Tolls',
  'Interest /Pension',
  'Phone',
  'Accountancy',
] as const;

export const BEAUTICIAN_CATEGORIES = [
  'Premises Rent',
  'Rates',
  'Electricity',
  'Product',
  'Professional Fees',
  'Marketing',
  'Equipment',
  'Sundry',
  'Phone',
  'Accountancy',
] as const;

export const DECLARATION_TEXT =
  'I confirm that the income and expenditure figures in this submission are accurate and complete to the best of my knowledge, and I authorise Tax for Taxi Drivers to use them in preparing my Making Tax Digital submission to HMRC.';

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  ready_to_sign: 'Ready to sign',
  client_signed: 'Awaiting counter-sign',
  signed: 'Fully signed',
};
