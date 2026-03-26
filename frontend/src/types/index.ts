// ── Auth ──
export interface User {
  id: number;
  name: string;
  username: string;
  employee_id: string;
  phone: string;
  email: string | null;
  avatar: string | null;
  status: UserStatus;
  created_at: string;
}

export type UserStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'suspended';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  plan: string;
  settings: Record<string, unknown> | null;
}

export interface Department {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export type Role = 'superadmin' | 'admin' | 'agent' | 'viewer';

export interface AuthResponse {
  user: User;
  organization: Organization;
  department: Department | null;
  role: Role;
  token: string;
}

// ── Access Request ──
export type AccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface AccessRequest {
  id: number;
  name: string;
  username: string;
  employee_id: string;
  phone: string;
  email: string | null;
  organization: Organization;
  department: Department;
  status: AccessRequestStatus;
  reviewed_by: User | null;
  reviewed_at: string | null;
  assigned_role: Role | null;
  reject_reason: string | null;
  expires_at: string;
  created_at: string;
}

// ── Contacts ──
export interface Contact {
  id: number;
  phone: string;
  name: string | null;
  email: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Conversations ──
export type ConversationStatus = 'open' | 'pending' | 'pending_handoff' | 'resolved' | 'closed';
export type Channel = 'whatsapp' | 'telegram' | 'email' | 'web';

export interface Conversation {
  id: number;
  contact: Contact;
  channel: Channel;
  status: ConversationStatus;
  assigned_to: number | null;
  assignee: User | null;
  last_message_at: string | null;
  created_at: string;
}

// ── Messages ──
export type MessageDirection = 'in' | 'out';
export type MessageType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'template' | 'interactive';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: number | string;
  conversation_id: number;
  direction: MessageDirection;
  type: MessageType;
  content: {
    text?: string;
    media_url?: string;
    filename?: string;
    caption?: string;
    [key: string]: unknown;
  };
  wa_message_id: string | null;
  status: MessageStatus;
  created_at: string;
}

// ── Campaigns ──
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';

export interface Campaign {
  id: number;
  name: string;
  type: 'broadcast' | 'survey';
  template_name: string | null;
  audience: Record<string, unknown> | null;
  scheduled_at: string | null;
  status: CampaignStatus;
  total_recipients: number;
  sent_at: string | null;
  created_at: string;
}

// ── AI Agents ──
export interface AgentConfig {
  personality: string;
  instructions: string;
  model: string;
  temperature: number;
  max_tokens: number;
  [key: string]: unknown;
}

export interface Agent {
  id: number;
  name: string;
  type: 'cs' | 'survey' | 'sales' | 'custom';
  config: AgentConfig;
  status: 'active' | 'paused' | 'disabled';
  created_at: string;
}