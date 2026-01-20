export type TaskStatus = 'open' | 'done' | 'overdue';
export type TaskType = 'Svar på tilbud' | 'Følg op' | 'Ring tilbage' | 'Send kontrakt';
export type DealStageId =
  | 'new_lead'
  | 'contacted'
  | 'meeting_booked'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost';
export type ActivityType = 'email' | 'call' | 'task' | 'note';
export type ActivityDirection = 'inbound' | 'outbound';
export type EmailConnectionType = 'OAuth' | 'IMAP_SMTP';
export type VerificationStatus = 'pending' | 'verified';

export interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  status: 'new' | 'contacted' | 'qualified' | 'disqualified';
  created_at: string;
  source: 'email' | 'call' | 'import' | 'manual';
}

export interface Customer {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  created_at: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage_id: DealStageId;
  stage_entered_at: string;
  created_at: string;
  customer_id?: string;
  lead_id?: string;
  employee_id: string;
}

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  status: TaskStatus;
  due_at: string;
  owner_user_id: string;
  created_at: string;
  completed_at?: string;
  related: {
    lead_id?: string;
    customer_id?: string;
    deal_id?: string;
  };
}

export interface PipelineStage {
  id: DealStageId;
  name: string;
  order: number;
}

export interface EmailAccount {
  id: string;
  address: string;
  display_name: string;
  connection_type: EmailConnectionType;
  status: 'connected' | 'needs_reauth' | 'error';
  last_sync_at?: string;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  subject: string;
  body: string;
  from: string;
  to: string[];
  created_at: string;
  direction: ActivityDirection;
}

export interface PhoneNumber {
  id: string;
  number: string;
  label?: string;
  verification_status: VerificationStatus;
  verified_at?: string;
}

export interface AgentPrompt {
  tone: string;
  sales_style: string;
  language: string;
  rules: string[];
}

export interface Agent {
  id: string;
  name: string;
  status: 'active' | 'paused';
  prompt: AgentPrompt;
  created_at: string;
}

export interface ActivityBase {
  id: string;
  type: ActivityType;
  created_at: string;
  summary: string;
  direction?: ActivityDirection;
  related: {
    lead_id?: string;
    customer_id?: string;
    deal_id?: string;
  };
}

export interface EmailActivity extends ActivityBase {
  type: 'email';
  message_id: string;
  subject: string;
}

export interface CallActivity extends ActivityBase {
  type: 'call';
  duration_seconds: number;
}

export interface TaskActivity extends ActivityBase {
  type: 'task';
  task_id: string;
}

export type Activity = EmailActivity | CallActivity | TaskActivity | ActivityBase;

export interface BulkRecipient {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  email: string;
}

