/**
 * AI Email Classification client
 * GitHub: https://github.com/waleedmagdy/AI-Email-Classification-Automation-System
 *
 * The system classifies incoming emails by category and priority using ML.
 * Configure the service URL + API key in the Integrations settings page.
 *
 * Expected API contract (POST /classify):
 *   Request:  { subject: string, body: string, sender?: string }
 *   Response: { category: string, priority: "high"|"medium"|"low",
 *               labels?: string[], confidence?: number, summary?: string }
 *
 * Batch endpoint (POST /classify/batch):
 *   Request:  { emails: Array<{ subject, body, sender? }> }
 *   Response: Array<ClassificationResult>
 *
 * Env-var fallback (optional):
 *   VITE_AICLASSIFY_URL    — base URL, e.g. https://classify.example.com
 *   VITE_AICLASSIFY_TOKEN  — API key / secret
 */

import { getServiceConfig } from './serviceConfig';

export interface ClassificationResult {
  category: string;
  priority: 'high' | 'medium' | 'low';
  labels: string[];
  confidence: number;
  summary?: string;
  action?: string;
}

function _cfg() {
  const c = getServiceConfig('aiclassify');
  const env = (import.meta as { env?: Record<string, string> }).env;
  return {
    url: (c?.url || env?.VITE_AICLASSIFY_URL || '').replace(/\/$/, ''),
    token: c?.token || env?.VITE_AICLASSIFY_TOKEN || '',
  };
}

function _headers(): Record<string, string> {
  const { token } = _cfg();
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
    h['X-API-Key'] = token;
  }
  return h;
}

function _url(): string {
  const { url } = _cfg();
  if (!url) throw new Error('AI Email Classification not configured');
  return url;
}

/** Classify a single email */
export async function classifyEmail(
  subject: string,
  body: string,
  sender = '',
): Promise<ClassificationResult> {
  const resp = await fetch(`${_url()}/classify`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({ subject, body, sender }),
  });
  if (!resp.ok) throw new Error(`AI Classify ${resp.status}: ${resp.statusText}`);
  return resp.json() as Promise<ClassificationResult>;
}

/** Classify multiple emails in one request */
export async function batchClassify(
  emails: Array<{ subject: string; body: string; sender?: string }>,
): Promise<ClassificationResult[]> {
  const resp = await fetch(`${_url()}/classify/batch`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({ emails }),
  });
  if (!resp.ok) throw new Error(`AI Classify batch ${resp.status}: ${resp.statusText}`);
  return resp.json() as Promise<ClassificationResult[]>;
}

/** Test the connection with a simple ping/health check */
export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { url } = _cfg();
    if (!url) return { ok: false, error: 'Not configured' };
    // Try health endpoint first, then a test classify call
    const healthResp = await fetch(`${url}/health`, { headers: _headers() }).catch(() => null);
    if (healthResp?.ok) return { ok: true };
    // Fallback: do a real classify call with test data
    await classifyEmail('Test email', 'This is a test');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Merge AI classification priority with keyword-based priority (AI wins if configured) */
export function mergePriority(
  aiResult: ClassificationResult | null,
  keywordPriority: 'high' | 'normal',
): 'high' | 'normal' {
  if (!aiResult) return keywordPriority;
  return aiResult.priority === 'high' ? 'high' : keywordPriority;
}
