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
  active?: boolean;
  phone?: string;
  companyName?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
  utr?: string;
  agentReference?: string;
  gocardlessCustomerId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
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
  /** Small files stored inline so admin/client can download later (max ~2 MB each). */
  dataUrl?: string;
  mimeType?: string;
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

export type ClientDocType = 'letter_of_engagement' | 'contract_tax_returns';
export type ClientDocStatus = 'sent' | 'signed';

export interface ClientDocument {
  id: string;
  userId: string;
  docType: ClientDocType;
  title: string;
  bodyHtml: string;
  status: ClientDocStatus;
  feeAmount?: string;
  clientSignature?: SignatureRecord;
  signedDocumentHtml?: string;
  signedAt?: string;
  sentAt: string;
  sentBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientFile {
  id: string;
  userId: string;
  name: string;
  mimeType: string;
  sizeLabel: string;
  note?: string;
  dataUrl: string;
  uploadedBy?: string;
  createdAt: string;
}

export interface Session {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  tradeType?: TradeType;
}

export interface PortalStore {
  users: User[];
  submissions: Submission[];
  campaigns: EmailCampaign[];
  documents: ClientDocument[];
  files: ClientFile[];
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

/** @deprecated Prefer importing from legal.ts — kept for existing imports. */
export { DECLARATION_TEXT } from './legal';

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  ready_to_sign: 'Ready to sign',
  client_signed: 'Awaiting counter-sign',
  signed: 'Fully signed',
};
