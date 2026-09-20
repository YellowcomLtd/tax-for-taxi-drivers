export type AppRole = 'admin' | 'client';
export type TradeType = 'taxi' | 'beautician';
export type SubmissionStatus = 'draft' | 'submitted' | 'ready_to_sign' | 'client_signed' | 'signed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: AppRole;
          trade_type: TradeType | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role: AppRole;
          trade_type?: TradeType | null;
          active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']> & {
          updated_at?: string;
        };
      };
      submissions: {
        Row: {
          id: string;
          user_id: string;
          period_label: string;
          trade_type: TradeType;
          status: SubmissionStatus;
          months: unknown;
          income: unknown;
          lines: unknown;
          files: unknown;
          sign_document: unknown | null;
          client_signature: unknown | null;
          admin_signature: unknown | null;
          signed_document_html: string | null;
          signed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period_label: string;
          trade_type: TradeType;
          status?: SubmissionStatus;
          months?: unknown;
          income?: unknown;
          lines?: unknown;
          files?: unknown;
          sign_document?: unknown | null;
          client_signature?: unknown | null;
          admin_signature?: unknown | null;
          signed_document_html?: string | null;
          signed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['submissions']['Insert']> & {
          updated_at?: string;
        };
      };
      email_campaigns: {
        Row: {
          id: string;
          subject: string;
          body: string;
          sent_by: string;
          sent_at: string;
          recipient_count: number;
          recipients: string[];
        };
        Insert: {
          id?: string;
          subject: string;
          body: string;
          sent_by: string;
          sent_at?: string;
          recipient_count?: number;
          recipients?: string[];
        };
        Update: Partial<Database['public']['Tables']['email_campaigns']['Insert']>;
      };
      email_notices: {
        Row: {
          id: string;
          to_email: string;
          subject: string;
          body: string;
          kind: string;
          meta: unknown;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          to_email: string;
          subject: string;
          body: string;
          kind?: string;
          meta?: unknown;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['email_notices']['Insert']>;
      };
    };
  };
}
