/**
 * Self-hosted service configuration manager.
 * Credentials are stored in localStorage under crater_svc_{name} keys.
 * They are set by the user via the Integrations settings page.
 */

export interface ServiceConfig {
  /** Base URL of the service, no trailing slash (e.g. https://ee.example.com) */
  url: string;
  /** API token / Bearer token */
  token?: string;
  /** Username for Basic-auth services (Listmonk) */
  username?: string;
  /** Password for Basic-auth services (Listmonk) */
  password?: string;
  /** Primary account identifier (EmailEngine) */
  accountId?: string;
  /** Default project/list ID */
  defaultProjectId?: string;
}

const KEY_PREFIX = 'crater_svc_';

export function getServiceConfig(name: string): ServiceConfig | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + name);
    if (!raw) return null;
    return JSON.parse(raw) as ServiceConfig;
  } catch {
    return null;
  }
}

export function setServiceConfig(name: string, config: ServiceConfig): void {
  localStorage.setItem(KEY_PREFIX + name, JSON.stringify(config));
}

export function clearServiceConfig(name: string): void {
  localStorage.removeItem(KEY_PREFIX + name);
}

export function isConfigured(name: string): boolean {
  const cfg = getServiceConfig(name);
  return !!(cfg?.url?.trim());
}
