/**
 * Vikunja client — https://github.com/go-vikunja/vikunja
 *
 * Vikunja is a self-hosted open-source task manager with projects, deadlines,
 * assigned users, and labels. Used here as a sync destination for CRM tasks.
 *
 * Configure the service URL + API token in the Integrations settings page.
 *
 * Env-var fallback (optional):
 *   VITE_VIKUNJA_URL            — base URL, e.g. https://vikunja.example.com
 *   VITE_VIKUNJA_TOKEN          — API token (create in Vikunja → Settings → API tokens)
 *   VITE_VIKUNJA_PROJECT_ID     — default project ID to create tasks in
 */

import { getServiceConfig } from './serviceConfig';

export interface VikunjaProject {
  id: number;
  title: string;
  description: string;
  identifier: string;
  is_archived: boolean;
  created: string;
  updated: string;
}

export interface VikunjaLabel {
  id: number;
  title: string;
  hex_color: string;
}

export interface VikunjaTask {
  id: number;
  title: string;
  description: string;
  done: boolean;
  /** 0=unset, 1=low, 2=medium, 3=high, 4=urgent, 5=DO NOW */
  priority: 0 | 1 | 2 | 3 | 4 | 5;
  due_date: string | null;
  start_date: string | null;
  end_date: string | null;
  created: string;
  updated: string;
  project_id: number;
  labels: VikunjaLabel[];
  assignees: Array<{ id: number; name: string; username: string; email: string }>;
  percent_done?: number;
  identifier?: string;
}

function _cfg() {
  const c = getServiceConfig('vikunja');
  const env = (import.meta as { env?: Record<string, string> }).env;
  return {
    url: (c?.url || env?.VITE_VIKUNJA_URL || '').replace(/\/$/, ''),
    token: c?.token || env?.VITE_VIKUNJA_TOKEN || '',
    projectId: Number(c?.defaultProjectId || env?.VITE_VIKUNJA_PROJECT_ID || 0),
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
  if (!url) throw new Error('Vikunja not configured');
  return url;
}

/** List all accessible projects */
export async function listProjects(): Promise<VikunjaProject[]> {
  const resp = await fetch(`${_url()}/api/v1/projects`, { headers: _headers() });
  if (!resp.ok) throw new Error(`Vikunja ${resp.status}: ${resp.statusText}`);
  return resp.json() as Promise<VikunjaProject[]>;
}

/** List all tasks across all projects */
export async function listAllTasks(page = 1, perPage = 50): Promise<VikunjaTask[]> {
  const params = new URLSearchParams({
    sort_by: 'created',
    order_by: 'desc',
    page: String(page),
    per_page: String(perPage),
  });
  const resp = await fetch(`${_url()}/api/v1/tasks/all?${params}`, { headers: _headers() });
  if (!resp.ok) throw new Error(`Vikunja ${resp.status}: ${resp.statusText}`);
  return resp.json() as Promise<VikunjaTask[]>;
}

/** List tasks in a specific project */
export async function listProjectTasks(projectId: number, page = 1, perPage = 50): Promise<VikunjaTask[]> {
  const params = new URLSearchParams({
    sort_by: 'created',
    order_by: 'desc',
    page: String(page),
    per_page: String(perPage),
  });
  const resp = await fetch(`${_url()}/api/v1/projects/${projectId}/tasks?${params}`, {
    headers: _headers(),
  });
  if (!resp.ok) throw new Error(`Vikunja ${resp.status}: ${resp.statusText}`);
  return resp.json() as Promise<VikunjaTask[]>;
}

/** Map CRM priority to Vikunja priority (0-5) */
export function mapPriority(p: 'low' | 'medium' | 'high' | 'urgent'): 0 | 1 | 2 | 3 | 4 | 5 {
  return ({ low: 1, medium: 2, high: 3, urgent: 5 } as const)[p] ?? 0;
}

/** Create a task in a Vikunja project */
export async function createTask(
  projectId: number,
  task: {
    title: string;
    description?: string;
    priority?: 0 | 1 | 2 | 3 | 4 | 5;
    due_date?: string | null;
  },
): Promise<VikunjaTask> {
  const resp = await fetch(`${_url()}/api/v1/projects/${projectId}/tasks`, {
    method: 'PUT',
    headers: _headers(),
    body: JSON.stringify({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority ?? 0,
      due_date: task.due_date ?? null,
    }),
  });
  if (!resp.ok) throw new Error(`Vikunja create ${resp.status}: ${resp.statusText}`);
  return resp.json() as Promise<VikunjaTask>;
}

/** Update a task */
export async function updateTask(taskId: number, data: Partial<VikunjaTask>): Promise<VikunjaTask> {
  const resp = await fetch(`${_url()}/api/v1/tasks/${taskId}`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error(`Vikunja update ${resp.status}: ${resp.statusText}`);
  return resp.json() as Promise<VikunjaTask>;
}

/** Mark a task as done */
export async function markDone(taskId: number): Promise<VikunjaTask> {
  return updateTask(taskId, { done: true });
}

/** Delete a task */
export async function deleteTask(taskId: number): Promise<void> {
  const resp = await fetch(`${_url()}/api/v1/tasks/${taskId}`, {
    method: 'DELETE',
    headers: _headers(),
  });
  if (!resp.ok) throw new Error(`Vikunja delete ${resp.status}: ${resp.statusText}`);
}

/** Test the connection */
export async function testConnection(): Promise<{ ok: boolean; error?: string; projects?: VikunjaProject[] }> {
  try {
    const projects = await listProjects();
    return { ok: true, projects };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Default project ID from config */
export function getDefaultProjectId(): number {
  return _cfg().projectId;
}
