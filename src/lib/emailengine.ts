/**
 * EmailEngine client — https://github.com/postalsys/emailengine
 *
 * EmailEngine turns any IMAP/SMTP mailbox into a REST API.
 * Configure the service URL + access token in the Integrations settings page.
 *
 * Env-var fallback (optional):
 *   VITE_EMAILENGINE_URL     — base URL, e.g. https://ee.example.com
 *   VITE_EMAILENGINE_TOKEN   — access token
 *   VITE_EMAILENGINE_ACCOUNT — default account (usually the email address)
 */

import { getServiceConfig } from './serviceConfig';

export interface EEAccount {
  account: string;
  name: string;
  email: string;
  state: 'connected' | 'authenticationError' | 'connectError' | 'init' | 'disconnected';
  syncedAt?: string;
}

export interface EEMessage {
  id: string;
  uid: number;
  path: string;
  subject: string;
  from: { name: string; address: string }[];
  to: { name: string; address: string }[];
  cc?: { name: string; address: string }[];
  date: string;
  seen: boolean;
  flagged?: boolean;
  draft?: boolean;
  size?: number;
  text?: { plain?: string; html?: string };
  preview?: string;
  messageId?: string;
}

function _cfg() {
  const c = getServiceConfig('emailengine');
  const env = (import.meta as { env?: Record<string, string> }).env;
  return {
    url: (c?.url || env?.VITE_EMAILENGINE_URL || '').replace(/\/$/, ''),
    token: c?.token || env?.VITE_EMAILENGINE_TOKEN || '',
    accountId: c?.accountId || env?.VITE_EMAILENGINE_ACCOUNT || '',
  };
}

function _headers(): Record<string, string> {
  const { token } = _cfg();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/** List all registered accounts in EmailEngine */
export async function listAccounts(): Promise<EEAccount[]> {
  const { url } = _cfg();
  if (!url) throw new Error('EmailEngine not configured');
  const resp = await fetch(`${url}/v1/accounts`, { headers: _headers() });
  if (!resp.ok) throw new Error(`EmailEngine ${resp.status}: ${resp.statusText}`);
  const data = await resp.json() as { accounts?: EEAccount[] };
  return data.accounts ?? [];
}

/** List messages in a mailbox folder */
export async function listMessages(
  account: string,
  path = 'INBOX',
  page = 0,
  pageSize = 50,
): Promise<EEMessage[]> {
  const { url } = _cfg();
  if (!url) throw new Error('EmailEngine not configured');
  const params = new URLSearchParams({
    path,
    page: String(page),
    pageSize: String(pageSize),
  });
  const resp = await fetch(`${url}/v1/account/${account}/messages?${params}`, {
    headers: _headers(),
  });
  if (!resp.ok) throw new Error(`EmailEngine ${resp.status}: ${resp.statusText}`);
  const data = await resp.json() as { messages?: EEMessage[] };
  return data.messages ?? [];
}

/** Send a message via EmailEngine */
export async function sendMessage(
  account: string,
  message: {
    to: string[];
    subject: string;
    text: string;
    html?: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
  },
): Promise<{ messageId: string; sendAt?: string }> {
  const { url } = _cfg();
  if (!url) throw new Error('EmailEngine not configured');
  const resp = await fetch(`${url}/v1/account/${account}/submit`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({
      to: message.to.map((a) => ({ address: a })),
      subject: message.subject,
      text: message.text,
      html: message.html,
      cc: message.cc?.map((a) => ({ address: a })),
      bcc: message.bcc?.map((a) => ({ address: a })),
      replyTo: message.replyTo ? { address: message.replyTo } : undefined,
    }),
  });
  if (!resp.ok) throw new Error(`EmailEngine send ${resp.status}: ${resp.statusText}`);
  return resp.json() as Promise<{ messageId: string; sendAt?: string }>;
}

/** Mark a message as read/unread */
export async function markSeen(account: string, messageId: string, seen: boolean): Promise<void> {
  const { url } = _cfg();
  const resp = await fetch(`${url}/v1/account/${account}/message/${messageId}`, {
    method: 'PATCH',
    headers: _headers(),
    body: JSON.stringify({ flags: { seen } }),
  });
  if (!resp.ok) throw new Error(`EmailEngine mark ${resp.status}`);
}

/** Test the connection — returns true if OK */
export async function testConnection(): Promise<{ ok: boolean; error?: string; accounts?: EEAccount[] }> {
  try {
    const accounts = await listAccounts();
    return { ok: true, accounts };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Convenience: get the default account ID from config */
export function getDefaultAccount(): string {
  return _cfg().accountId;
}
