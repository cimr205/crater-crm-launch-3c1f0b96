/**
 * Listmonk client — https://github.com/knadh/listmonk
 *
 * Listmonk is a self-hosted high-performance newsletter and mailing-list manager.
 * Configure the service URL + username + password in the Integrations settings page.
 *
 * Env-var fallback (optional):
 *   VITE_LISTMONK_URL       — base URL, e.g. https://listmonk.example.com
 *   VITE_LISTMONK_USERNAME  — username (default: listmonk)
 *   VITE_LISTMONK_PASSWORD  — password / API token
 */

import { getServiceConfig } from './serviceConfig';

export interface ListmonkList {
  id: number;
  created_at: string;
  updated_at: string;
  uuid: string;
  name: string;
  type: 'private' | 'public';
  optin: 'single' | 'double';
  tags: string[];
  subscriber_count: number;
}

export interface ListmonkCampaign {
  id: number;
  created_at: string;
  updated_at: string;
  uuid: string;
  name: string;
  subject: string;
  from_email: string;
  type: 'regular' | 'optin';
  content_type: 'richtext' | 'plain' | 'html' | 'markdown';
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'cancelled' | 'finished';
  tags: string[];
  send_at: string | null;
  started_at: string | null;
  to_send: number;
  sent: number;
  views: number;
  clicks: number;
  bounces: number;
  lists: Array<{ id: number; name: string }>;
}

export interface ListmonkSubscriber {
  id: number;
  created_at: string;
  updated_at: string;
  uuid: string;
  email: string;
  name: string;
  status: 'enabled' | 'disabled' | 'blocklisted';
  lists: Array<{ id: number; name: string; status: string }>;
}

function _cfg() {
  const c = getServiceConfig('listmonk');
  const env = (import.meta as { env?: Record<string, string> }).env;
  return {
    url: (c?.url || env?.VITE_LISTMONK_URL || '').replace(/\/$/, ''),
    username: c?.username || env?.VITE_LISTMONK_USERNAME || 'listmonk',
    password: c?.password || env?.VITE_LISTMONK_PASSWORD || '',
  };
}

function _headers(): Record<string, string> {
  const { username, password } = _cfg();
  return {
    Authorization: `Basic ${btoa(`${username}:${password}`)}`,
    'Content-Type': 'application/json',
  };
}

function _url(): string {
  const { url } = _cfg();
  if (!url) throw new Error('Listmonk not configured');
  return url;
}

/** List all mailing lists */
export async function getLists(page = 1, perPage = 100): Promise<ListmonkList[]> {
  const resp = await fetch(
    `${_url()}/api/lists?page=${page}&per_page=${perPage}`,
    { headers: _headers() },
  );
  if (!resp.ok) throw new Error(`Listmonk ${resp.status}: ${resp.statusText}`);
  const data = await resp.json() as { data?: { results?: ListmonkList[] } };
  return data.data?.results ?? [];
}

/** List campaigns */
export async function getCampaigns(page = 1, perPage = 50): Promise<ListmonkCampaign[]> {
  const resp = await fetch(
    `${_url()}/api/campaigns?page=${page}&per_page=${perPage}&order_by=created_at&order=DESC`,
    { headers: _headers() },
  );
  if (!resp.ok) throw new Error(`Listmonk ${resp.status}: ${resp.statusText}`);
  const data = await resp.json() as { data?: { results?: ListmonkCampaign[] } };
  return data.data?.results ?? [];
}

/** Create a new campaign */
export async function createCampaign(campaign: {
  name: string;
  subject: string;
  body: string;
  list_ids: number[];
  from_email?: string;
  content_type?: 'richtext' | 'plain' | 'html' | 'markdown';
  template_id?: number;
}): Promise<ListmonkCampaign> {
  const resp = await fetch(`${_url()}/api/campaigns`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({
      name: campaign.name,
      subject: campaign.subject,
      body: campaign.body,
      lists: campaign.list_ids,
      from_email: campaign.from_email ?? '',
      content_type: campaign.content_type ?? 'plain',
      template_id: campaign.template_id ?? 1,
      type: 'regular',
    }),
  });
  if (!resp.ok) throw new Error(`Listmonk create campaign ${resp.status}: ${resp.statusText}`);
  const data = await resp.json() as { data?: ListmonkCampaign };
  return data.data!;
}

/** Update campaign status (running | paused | cancelled | scheduled | draft) */
export async function updateCampaignStatus(
  id: number,
  status: 'running' | 'paused' | 'cancelled' | 'scheduled' | 'draft',
): Promise<ListmonkCampaign> {
  const resp = await fetch(`${_url()}/api/campaigns/${id}/status`, {
    method: 'PUT',
    headers: _headers(),
    body: JSON.stringify({ status }),
  });
  if (!resp.ok) throw new Error(`Listmonk status ${resp.status}: ${resp.statusText}`);
  const data = await resp.json() as { data?: ListmonkCampaign };
  return data.data!;
}

/** Add or update a subscriber */
export async function upsertSubscriber(
  email: string,
  name: string,
  listIds: number[],
): Promise<ListmonkSubscriber> {
  const resp = await fetch(`${_url()}/api/subscribers`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({
      email,
      name,
      lists: listIds,
      status: 'enabled',
      preconfirm_subscriptions: true,
    }),
  });
  // 409 = subscriber already exists — fetch and return as-is
  if (resp.status === 409) {
    const all = await fetch(`${_url()}/api/subscribers?query=${encodeURIComponent(email)}&page=1&per_page=1`, {
      headers: _headers(),
    });
    const d = await all.json() as { data?: { results?: ListmonkSubscriber[] } };
    const existing = d.data?.results?.[0];
    if (!existing) throw new Error('Listmonk: subscriber not found after 409');
    return existing;
  }
  if (!resp.ok) throw new Error(`Listmonk upsert subscriber ${resp.status}: ${resp.statusText}`);
  const data = await resp.json() as { data?: ListmonkSubscriber };
  return data.data!;
}

/** Test the connection */
export async function testConnection(): Promise<{ ok: boolean; error?: string; lists?: ListmonkList[] }> {
  try {
    const lists = await getLists(1, 5);
    return { ok: true, lists };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
