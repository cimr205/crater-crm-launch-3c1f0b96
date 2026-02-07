const resolvedApiBase =
  typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:4000/api';
const API_BASE_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL || resolvedApiBase;
export const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api$/, '');
interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('crater_token', token);
    } else {
      localStorage.removeItem('crater_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('crater_token');
    }
    return this.token;
  }

  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const token = this.getToken();
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    };

    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
    const tenantRaw = localStorage.getItem('tenant_defaults');
    if (tenantRaw) {
      try {
        const tenant = JSON.parse(tenantRaw) as { tenantId?: string };
        if (tenant.tenantId) {
          requestHeaders['X-Tenant-Id'] = tenant.tenantId;
        }
      } catch {
        // ignore invalid tenant storage
      }
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.setToken(null);
        window.location.href = '/login';
      }
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setToken(response.token);
    return response;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getMe() {
    return this.request<{ data: User }>('/me');
  }

  async getAdminOverview() {
    return this.request<{ companies: AdminCompany[]; users: AdminUser[] }>('/admin/overview');
  }

  async registerCompany(input: {
    companyName: string;
    adminName: string;
    email: string;
    password: string;
    language: string;
    theme: string;
  }) {
    return this.request<{ tenant: TenantSettings; user: User }>('/auth/register-company', {
      method: 'POST',
      body: {
        company_name: input.companyName,
        admin_name: input.adminName,
        email: input.email,
        password: input.password,
        language: input.language,
        theme: input.theme,
      },
    });
  }

  async joinCompany(input: { joinCode: string; name: string; email: string; password: string }) {
    return this.request<{ tenant: TenantSettings; user: User }>('/auth/join-company', {
      method: 'POST',
      body: {
        join_code: input.joinCode,
        name: input.name,
        email: input.email,
        password: input.password,
      },
    });
  }

  async updateCompanySettings(input: { language: string; theme: string }) {
    return this.request<{ tenant: TenantSettings }>('/company/settings', {
      method: 'PATCH',
      body: input,
    });
  }

  async getTenantIntegrations() {
    return this.request<{
      metaConnected: boolean;
      metaAdAccountId: string | null;
      metaBusinessId: string | null;
      metaTokenExpiresAt: string | null;
      websiteTrackingKey: string;
      websiteDomains: string[];
      metaPixelId: string | null;
      metaCapiTokenSet: boolean;
    }>('/tenant/integrations');
  }

  async updateTenantIntegrations(input: {
    websiteDomains?: string[];
    metaPixelId?: string | null;
    metaCapiToken?: string | null;
    rotateTrackingKey?: boolean;
  }) {
    return this.request<{
      websiteTrackingKey: string;
      websiteDomains: string[];
      metaPixelId: string | null;
      metaCapiTokenSet: boolean;
    }>('/tenant/integrations', {
      method: 'PATCH',
      body: {
        website_domains: input.websiteDomains,
        meta_pixel_id: input.metaPixelId,
        meta_capi_token: input.metaCapiToken,
        rotate_tracking_key: input.rotateTrackingKey,
      },
    });
  }

  async getMetaStatus() {
    return this.request<{
      connected: boolean;
      meta_ad_account_id?: string;
      meta_business_id?: string;
      token_expires_at?: string;
    }>('/meta/status');
  }

  async startMetaConnect() {
    return this.request<{ auth_url: string; state: string }>('/meta/connect');
  }

  async createInvitation(email: string, role: 'admin' | 'user' = 'user') {
    return this.request<{ invitation_id: string; token: string; expires_at: string }>('/admin/invitations', {
      method: 'POST',
      body: { email, role },
    });
  }

  async listAiActions() {
    return this.request<{
      data: Array<{
        id: string;
        name: string;
        description: string;
        inputs: string[];
        outputs: string[];
        defaultMode: 'draft' | 'auto';
      }>;
    }>('/ai/actions');
  }

  async getAiSettings() {
    return this.request<{
      data: {
        enabledActions: string[];
        toneOfVoice: string;
        autoSendMode: 'draft' | 'auto';
        bookingWindowStart: string;
        bookingWindowEnd: string;
        bookingTimezone: string;
      };
    }>('/ai/settings');
  }

  async updateAiSettings(input: {
    enabledActions?: string[];
    toneOfVoice?: string;
    autoSendMode?: 'draft' | 'auto';
    bookingWindowStart?: string;
    bookingWindowEnd?: string;
    bookingTimezone?: string;
  }) {
    return this.request<{
      data: {
        enabledActions: string[];
        toneOfVoice: string;
        autoSendMode: 'draft' | 'auto';
        bookingWindowStart: string;
        bookingWindowEnd: string;
        bookingTimezone: string;
      };
    }>('/ai/settings', {
      method: 'PATCH',
      body: {
        enabled_actions: input.enabledActions,
        tone_of_voice: input.toneOfVoice,
        auto_send_mode: input.autoSendMode,
        booking_window_start: input.bookingWindowStart,
        booking_window_end: input.bookingWindowEnd,
        booking_timezone: input.bookingTimezone,
      },
    });
  }

  async syncMetaLeads() {
    return this.request<{ status: string }>('/meta/leads/sync', { method: 'POST' });
  }

  async getClowdBotStatus() {
    return this.request<{
      totals: { jobs: number; active_jobs: number };
      integrations: Array<{ provider: string; authType: string; status: string; updatedAt: string }>;
    }>('/clowdbot/status');
  }

  async listClowdBotIntegrations() {
    return this.request<{ data: Array<{ provider: string; authType: string; status: string; updatedAt: string }> }>(
      '/clowdbot/integrations'
    );
  }

  async connectClowdBotIntegration(input: {
    provider: string;
    authType: 'api_key' | 'oauth' | 'token';
    apiKey?: string;
    accessToken?: string;
    refreshToken?: string;
    instanceUrl?: string;
    projectId?: string;
    additional?: Record<string, string>;
  }) {
    return this.request<{ status: string }>(`/clowdbot/integrations/${input.provider}`, {
      method: 'POST',
      body: {
        auth_type: input.authType,
        api_key: input.apiKey,
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
        instance_url: input.instanceUrl,
        project_id: input.projectId,
        additional: input.additional,
      },
    });
  }

  async removeClowdBotIntegration(provider: string) {
    return this.request<{ status: string }>(`/clowdbot/integrations/${provider}`, { method: 'DELETE' });
  }

  async listClowdBotJobs() {
    return this.request<{ data: Array<Record<string, unknown>> }>('/clowdbot/jobs');
  }

  async createClowdBotJob(input: {
    name: string;
    keywords?: string[];
    industries?: string[];
    countries?: string[];
    locations?: string[];
    companySize?: string;
    roles?: string[];
    sources: string[];
    intervalMinutes?: number;
    deliverHour?: number;
    deliverTimezone?: string;
  }) {
    return this.request<{ data: Record<string, unknown> }>('/clowdbot/jobs', {
      method: 'POST',
      body: {
        name: input.name,
        criteria: {
          keywords: input.keywords,
          industries: input.industries,
          countries: input.countries,
          locations: input.locations,
          company_size: input.companySize,
          roles: input.roles,
        },
        sources: input.sources,
        schedule: {
          interval_minutes: input.intervalMinutes,
          deliver_hour: input.deliverHour,
          deliver_timezone: input.deliverTimezone,
        },
      },
    });
  }

  async updateClowdBotJob(jobId: string, input: { status?: 'active' | 'paused' }) {
    return this.request<{ data: Record<string, unknown> }>(`/clowdbot/jobs/${jobId}`, {
      method: 'PATCH',
      body: input,
    });
  }

  async runClowdBotJob(jobId: string) {
    return this.request<{ status: string; created: number }>(`/clowdbot/jobs/${jobId}/run`, { method: 'POST' });
  }

  async listIntegrationProviders() {
    return this.request<{
      providers: Array<{ id: string; label: string; supportsOAuth: boolean }>;
      connections: Array<{ provider: string; connectedAt: string; updatedAt: string }>;
    }>('/integrations/providers');
  }

  async disconnectIntegration(provider: string) {
    return this.request<{ status: string }>(`/integrations/${provider}`, { method: 'DELETE' });
  }

  async listWorkflows() {
    return this.request<{ data: Array<Record<string, unknown>>; suggestions?: Array<Record<string, unknown>> }>(
      '/workflows'
    );
  }

  async createWorkflow(input: {
    name: string;
    triggerType: 'new_lead_created' | 'integration_connected' | 'manual_trigger';
    steps: Array<{ type: 'condition' | 'action' | 'delay'; config: Record<string, unknown>; stepOrder: number }>;
  }) {
    return this.request<{ data: Record<string, unknown> }>('/workflows', {
      method: 'POST',
      body: {
        name: input.name,
        trigger_type: input.triggerType,
        steps: input.steps.map((step) => ({
          type: step.type,
          config: step.config,
          step_order: step.stepOrder,
        })),
      },
    });
  }

  async activateWorkflow(id: string) {
    return this.request<{ data: Record<string, unknown> }>(`/workflows/${id}/activate`, { method: 'POST' });
  }

  async pauseWorkflow(id: string) {
    return this.request<{ data: Record<string, unknown> }>(`/workflows/${id}/pause`, { method: 'POST' });
  }

  async runWorkflowTest(workflowId: string, leadId?: string) {
    return this.request<{ status: string; run_id: string }>('/workflow/run/test', {
      method: 'POST',
      body: { workflow_id: workflowId, lead_id: leadId },
    });
  }

  async approveAiSuggestion(id: string) {
    return this.request<{ status: string }>(`/ai/approve/${id}`, { method: 'POST' });
  }

  async rejectAiSuggestion(id: string) {
    return this.request<{ status: string }>(`/ai/reject/${id}`, { method: 'POST' });
  }

  async getAiActivity() {
    return this.request<{ data: Array<{ id: string; message: string; type: string; createdAt: string }> }>(
      '/api/ai/activity'
    );
  }

  async aiChat(message: string) {
    return this.request<{ message: string; action?: Record<string, unknown> }>('/api/ai/chat', {
      method: 'POST',
      body: { prompt: message },
    });
  }

  async getDailyFocus() {
    return this.request<{ data: { json: Array<Record<string, unknown>> } | null }>('/api/ai/daily-focus');
  }

  async refreshDailyFocus() {
    return this.request<{ data: { json: Array<Record<string, unknown>> } | null }>(
      '/api/ai/daily-focus/refresh',
      { method: 'POST' }
    );
  }

  getIntegrationAuthUrl(provider: string) {
    const token = this.getToken();
    if (!token) return null;
    const params = new URLSearchParams({ token });
    return `${BACKEND_BASE_URL}/auth/${provider}/start?${params.toString()}`;
  }

  // Customers
  async getCustomers(params?: { page?: number; limit?: number }) {
    const query = params ? `?page=${params.page || 1}&limit=${params.limit || 10}` : '';
    return this.request<{ data: Customer[]; meta: PaginationMeta }>(`/customers${query}`);
  }

  async getCustomer(id: number) {
    return this.request<{ data: Customer }>(`/customers/${id}`);
  }

  // Invoices
  async getInvoices(params?: { page?: number; limit?: number; status?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<{ data: Invoice[]; meta: PaginationMeta }>(`/invoices${query}`);
  }

  async getInvoice(id: number) {
    return this.request<{ data: Invoice }>(`/invoices/${id}`);
  }

  // Payments
  async getPayments(params?: { page?: number; limit?: number }) {
    const query = params ? `?page=${params.page || 1}&limit=${params.limit || 10}` : '';
    return this.request<{ data: Payment[]; meta: PaginationMeta }>(`/payments${query}`);
  }

  // Dashboard
  async getDashboard() {
    return this.request<DashboardData>('/dashboard');
  }

  async getLeadDashboard() {
    return this.request<{
      totals: { leads: number; leads_today: number; active_clowdbot_jobs: number };
      recent: Array<{
        id: string;
        name: string;
        email?: string;
        company?: string;
        status: string;
        leadScore: number;
        source?: string;
        createdAt: string;
      }>;
    }>('/lead-dashboard');
  }

  async listLeads(params?: { status?: string; source?: string; q?: string }) {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.source) search.set('source', params.source);
    if (params?.q) search.set('q', params.q);
    const query = search.toString() ? `?${search.toString()}` : '';
    return this.request<{
      data: Array<{
        id: string;
        name: string;
        email?: string;
        phone: string;
        company?: string;
        status: string;
        leadScore: number;
        source?: string;
        notes?: string;
        createdAt: string;
      }>;
    }>(`/leads${query}`);
  }

  async createLead(input: {
    name: string;
    phone: string;
    email?: string;
    company?: string;
    status?: string;
  }) {
    return this.request<{ data: unknown }>('/leads', {
      method: 'POST',
      body: input,
    });
  }

  async updateLead(id: string, input: { status?: string; notes?: string; lastContactedAt?: string }) {
    return this.request<{ data: unknown }>(`/leads/${id}`, {
      method: 'PATCH',
      body: {
        status: input.status,
        notes: input.notes,
        last_contacted_at: input.lastContactedAt,
      },
    });
  }

  async getCompanyHistory(month?: string) {
    const query = month ? `?month=${month}` : '';
    return this.request<{ month: string; data: WorkHistoryItem[] }>(`/company/work-items/history${query}`);
  }

  async getCompanyHistorySummary(month?: string) {
    const query = month ? `?month=${month}` : '';
    return this.request<{ month: string; totals: WorkHistorySummary }>(
      `/company/work-items/history/summary${query}`
    );
  }

  async getCompanyHistoryByUser(month?: string) {
    const query = month ? `?month=${month}` : '';
    return this.request<{ month: string; users: WorkHistoryUser[] }>(`/company/work-items/history/users${query}`);
  }

  async getCompanyHistoryYear(year?: string) {
    const query = year ? `?year=${year}` : '';
    return this.request<{ year: string; months: WorkHistoryMonth[] }>(`/company/work-items/history/year${query}`);
  }

  async downloadCompanyHistoryCsv(month?: string) {
    const token = this.getToken();
    const query = month ? `?month=${month}` : '';
    const headers: Record<string, string> = { Accept: 'text/csv' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/company/work-items/history/export${query}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to export CSV' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return response.blob();
  }

  async downloadAdminCompaniesHistoryCsv(month?: string) {
    const token = this.getToken();
    const query = month ? `?month=${month}` : '';
    const headers: Record<string, string> = { Accept: 'text/csv' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/admin/companies/history/export${query}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to export CSV' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return response.blob();
  }
}

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  company_id?: string;
}

export interface TenantSettings {
  id: string;
  name: string;
  join_code: string;
  default_language: string;
  default_theme: string;
}

export interface AdminCompany {
  id: string;
  name: string;
  joinCode?: string;
  defaultLanguage?: string;
  defaultTheme?: string;
  userCount: number;
  createdAt?: string;
}

export interface AdminUser {
  id: string;
  name?: string;
  email: string;
  role: string;
  company_id?: string;
  created_at: string;
  email_verified: boolean;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  company_name?: string;
  billing_address?: Address;
  due_amount: number;
  created_at: string;
}

export interface Address {
  address_street_1?: string;
  address_street_2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer: Customer;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'OVERDUE' | 'COMPLETED' | 'PAID';
  invoice_date: string;
  due_date: string;
  total: number;
  due_amount: number;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: number;
  name: string;
  description?: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Payment {
  id: number;
  payment_number: string;
  customer: Customer;
  invoice?: Invoice;
  amount: number;
  payment_date: string;
  payment_method?: string;
  notes?: string;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface DashboardData {
  total_customers: number;
  total_invoices: number;
  total_amount_due: number;
  total_paid: number;
  recent_invoices: Invoice[];
  recent_customers: Customer[];
}

export interface WorkHistoryItem {
  id: string;
  type: 'todo' | 'task' | 'campaign';
  title: string;
  status: string;
  category?: string;
  source?: string;
  completedAt?: string;
}

export type WorkHistorySummary = Record<string, number>;

export interface WorkHistoryUser {
  id: string;
  name?: string;
  email: string;
  total: number;
  totals: WorkHistorySummary;
}

export interface WorkHistoryMonth {
  month: string;
  total: number;
  totals: WorkHistorySummary;
}

export const api = new ApiClient();
