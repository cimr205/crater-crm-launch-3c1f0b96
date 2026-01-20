import fs from 'fs';
import path from 'path';

const dbPath = process.env.DB_PATH || './data.json';
const resolvedPath = path.resolve(dbPath);

export interface StoreUser {
  id: string;
  name?: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt?: string;
  role: 'admin' | 'user';
  companyId?: string;
  createdAt: string;
}

export interface StoreCompany {
  id: string;
  name: string;
  ownerUserId?: string;
  userLimit?: number;
  createdAt: string;
}

export interface StoreOAuthState {
  id: string;
  state: string;
  inviteToken?: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoreInvitation {
  id: string;
  companyId: string;
  email: string;
  role: 'admin' | 'user';
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface StoreMessage {
  id: string;
  companyId: string;
  senderUserId: string;
  recipientUserId: string;
  subject: string;
  body: string;
  createdAt: string;
  readAt?: string;
}

export interface StoreNotification {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string;
}

export interface StoreCalendarEvent {
  id: string;
  companyId: string;
  ownerUserId: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  participantUserIds: string[];
  createdAt: string;
}

export interface StoreSession {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoreEmailVerification {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoreLead {
  id: string;
  ownerUserId: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  status: string;
  leadScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreTask {
  id: string;
  ownerUserId: string;
  type: string;
  title: string;
  status: string;
  dueAt: string;
  completedAt?: string;
  leadId?: string;
  customerId?: string;
  dealId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreDeal {
  id: string;
  ownerUserId: string;
  title: string;
  value: number;
  stageId: string;
  stageEnteredAt: string;
  employeeId?: string;
  leadId?: string;
  customerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreActivity {
  id: string;
  ownerUserId: string;
  leadId?: string;
  customerId?: string;
  dealId?: string;
  type: string;
  direction?: string;
  summary: string;
  subject?: string;
  messageId?: string;
  createdAt: string;
}

export interface StoreData {
  users: StoreUser[];
  companies: StoreCompany[];
  oauthStates: StoreOAuthState[];
  invitations: StoreInvitation[];
  messages: StoreMessage[];
  notifications: StoreNotification[];
  calendarEvents: StoreCalendarEvent[];
  sessions: StoreSession[];
  emailVerifications: StoreEmailVerification[];
  leads: StoreLead[];
  tasks: StoreTask[];
  deals: StoreDeal[];
  activities: StoreActivity[];
}

const emptyStore: StoreData = {
  users: [],
  companies: [],
  oauthStates: [],
  invitations: [],
  messages: [],
  notifications: [],
  calendarEvents: [],
  sessions: [],
  emailVerifications: [],
  leads: [],
  tasks: [],
  deals: [],
  activities: [],
};

function loadStore(): StoreData {
  if (!fs.existsSync(resolvedPath)) {
    return { ...emptyStore };
  }
  const raw = fs.readFileSync(resolvedPath, 'utf-8');
  if (!raw.trim()) return { ...emptyStore };
  const parsed = JSON.parse(raw) as Partial<StoreData>;
  const users = (parsed.users || []).map((user) => ({
    ...user,
    role: user.role || 'user',
  }));
  return {
    users,
    companies: parsed.companies || [],
    oauthStates: parsed.oauthStates || [],
    invitations: parsed.invitations || [],
    messages: parsed.messages || [],
    notifications: parsed.notifications || [],
    calendarEvents: parsed.calendarEvents || [],
    sessions: parsed.sessions || [],
    emailVerifications: parsed.emailVerifications || [],
    leads: parsed.leads || [],
    tasks: parsed.tasks || [],
    deals: parsed.deals || [],
    activities: parsed.activities || [],
  };
}

function saveStore(store: StoreData) {
  fs.writeFileSync(resolvedPath, JSON.stringify(store, null, 2));
}

export function initStore() {
  if (!fs.existsSync(resolvedPath)) {
    saveStore(emptyStore);
  }
}

export function readStore(): StoreData {
  return loadStore();
}

export function updateStore<T>(mutator: (store: StoreData) => T): T {
  const store = loadStore();
  const result = mutator(store);
  saveStore(store);
  return result;
}

