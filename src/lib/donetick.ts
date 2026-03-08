/**
 * Donetick client — https://github.com/donetick/donetick
 *
 * Donetick is a self-hosted task/chore manager with recurring schedules,
 * assignments, and notifications. Used here as the backend for personal Todos.
 *
 * Configure the service URL + API token in the Integrations settings page.
 * Generate an API token in Donetick → Profile → API Tokens.
 *
 * Env-var fallback (optional):
 *   VITE_DONETICK_URL    — base URL, e.g. https://donetick.example.com
 *   VITE_DONETICK_TOKEN  — API token
 */

import { getServiceConfig } from './serviceConfig';

export interface DonetickChore {
  id: number;
  name: string;
  description: string;
  frequencyType: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'interval' | 'days_of_week' | 'no_repeat';
  nextDueDate: string | null;
  isActive: boolean;
  completedAt?: string | null;
  assignedTo?: number | null;
  updatedAt: string;
  createdAt: string;
}

function _cfg() {
  const c = getServiceConfig('donetick');
  const env = (import.meta as { env?: Record<string, string> }).env;
  return {
    url: (c?.url || env?.VITE_DONETICK_URL || '').replace(/\/$/, ''),
    token: c?.token || env?.VITE_DONETICK_TOKEN || '',
  };
}

function _headers(): Record<string, string> {
  const { token } = _cfg();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function _url(): string {
  const { url } = _cfg();
  if (!url) throw new Error('Donetick not configured');
  return url;
}

/** List all chores (todos) */
export async function listChores(): Promise<DonetickChore[]> {
  const resp = await fetch(`${_url()}/api/v1/chores`, { headers: _headers() });
  if (!resp.ok) throw new Error(`Donetick ${resp.status}: ${resp.statusText}`);
  const data = await resp.json() as { res?: DonetickChore[] } | DonetickChore[];
  return Array.isArray(data) ? data : (data as { res?: DonetickChore[] }).res ?? [];
}

/** Create a new one-time chore (todo) */
export async function createChore(
  name: string,
  description = '',
  nextDueDate?: string | null,
): Promise<DonetickChore> {
  const resp = await fetch(`${_url()}/api/v1/chores`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({
      name,
      description,
      frequencyType: 'once',
      nextDueDate: nextDueDate ?? null,
      isActive: true,
    }),
  });
  if (!resp.ok) throw new Error(`Donetick create ${resp.status}: ${resp.statusText}`);
  const data = await resp.json() as { res?: DonetickChore } | DonetickChore;
  return ('res' in data ? data.res : data) as DonetickChore;
}

/** Mark a chore as completed */
export async function completeChore(id: number): Promise<void> {
  const resp = await fetch(`${_url()}/api/v1/chores/${id}/do`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({ completedDate: new Date().toISOString() }),
  });
  if (!resp.ok) throw new Error(`Donetick complete ${resp.status}: ${resp.statusText}`);
}

/** Delete a chore */
export async function deleteChore(id: number): Promise<void> {
  const resp = await fetch(`${_url()}/api/v1/chores/${id}`, {
    method: 'DELETE',
    headers: _headers(),
  });
  if (!resp.ok) throw new Error(`Donetick delete ${resp.status}: ${resp.statusText}`);
}

/** Update a chore's properties */
export async function updateChore(
  id: number,
  data: Partial<Pick<DonetickChore, 'name' | 'description' | 'nextDueDate' | 'isActive'>>,
): Promise<DonetickChore> {
  const resp = await fetch(`${_url()}/api/v1/chores/${id}`, {
    method: 'PUT',
    headers: _headers(),
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error(`Donetick update ${resp.status}: ${resp.statusText}`);
  const result = await resp.json() as { res?: DonetickChore } | DonetickChore;
  return ('res' in result ? result.res : result) as DonetickChore;
}

/** Test the connection */
export async function testConnection(): Promise<{ ok: boolean; error?: string; count?: number }> {
  try {
    const chores = await listChores();
    return { ok: true, count: chores.length };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
