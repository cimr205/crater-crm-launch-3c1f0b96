const resolvedApiBase =
  typeof window !== 'undefined' ? `https://api.aiagencydanmark.dk/api` : 'http://localhost:4000/api';
export const API_BASE_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL || resolvedApiBase;
export const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api$/, '');
interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;
  private refreshToken: string | null = null;

  setSession(session: { accessToken: string; refreshToken: string } | null) {
    this.token = session?.accessToken || null;
    this.refreshToken = session?.refreshToken || null;

    if (this.token) {
      localStorage.setItem('crater_token', this.token);
    } else {
      localStorage.removeItem('crater_token');
    }

    if (this.refreshToken) {
      localStorage.setItem('crater_refresh_token', this.refreshToken);
    } else {
      localStorage.removeItem('crater_refresh_token');
    }
  }

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

  getRefreshToken(): string | null {
    if (!this.refreshToken) {
      this.refreshToken = localStorage.getItem('crater_refresh_token');
    }
    return this.refreshToken;
  }

  private persistTenantDefaults(company: Pick<TenantSettings, 'id' | 'name'> & Partial<TenantSettings>) {
    const existingRaw = localStorage.getItem('tenant_defaults');
    let existing: Record<string, unknown> = {};

    if (existingRaw) {
      try {
        existing = JSON.parse(existingRaw) as Record<string, unknown>;
      } catch {
        existing = {};
      }
    }

    localStorage.setItem(
      'tenant_defaults',
      JSON.stringify({
        ...existing,
        tenantId: company.id,
        companyName: company.name,
        joinCode: company.invite_code || existing.joinCode || null,
        inviteCode: company.invite_code || existing.inviteCode || null,
        defaultLanguage: existing.defaultLanguage || 'en',
        defaultTheme: existing.defaultTheme || 'light',
      })
    );
  }

  private async hydrateTenant(company: { id: string; name: string }) {
    try {
      const settings = await this.getCompanySettings();
      this.persistTenantDefaults(settings.tenant);
      return settings.tenant;
    } catch {
      const fallbackTenant: TenantSettings = {
        id: company.id,
        name: company.name,
        plan: 'starter',
        payment_status: 'pending',
        is_active: true,
        created_at: new Date().toISOString(),
      };
      this.persistTenantDefaults(fallbackTenant);
      return fallbackTenant;
    }
  }

  private async refreshSessionIfNeeded() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      this.setSession(null);
      return false;
    }

    const payload = await response.json().catch(() => null) as
      | {
          ok?: boolean;
          data?: {
            session?: {
              access_token?: string;
              refresh_token?: string;
            };
          };
        }
      | null;

    const accessToken = payload?.data?.session?.access_token;
    const nextRefreshToken = payload?.data?.session?.refresh_token;

    if (!accessToken || !nextRefreshToken) {
      this.setSession(null);
      return false;
    }

    this.setSession({ accessToken, refreshToken: nextRefreshToken });
    return true;
  }

  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const execute = async () => {
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

      return fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
    };

    let response = await execute();

    if (response.status === 401) {
      const refreshed = await this.refreshSessionIfNeeded();
      if (refreshed) {
        response = await execute();
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        this.setSession(null);
        localStorage.removeItem('tenant_defaults');
        window.location.href = '/en/auth/login';
      }
      const error = await response.json().catch(() => ({ message: 'An error occurred' })) as {
        message?: string;
        error?: { message?: string };
      };
      throw new Error(error?.error?.message || error?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async signup(fullName: string, email: string, password: string) {
    const response = await this.request<{
      ok: true;
      data: {
        session: {
          access_token: string;
          refresh_token: string;
        };
        user: User;
      };
    }>('/v1/auth/signup', {
      method: 'POST',
      body: { full_name: fullName, email, password },
    });

    this.setSession({
      accessToken: response.data.session.access_token,
      refreshToken: response.data.session.refresh_token,
    });

    return { user: response.data.user };
  }

  async getGate() {
    const response = await this.request<{
      ok: true;
      data: {
        onboarding_completed: boolean;
        has_company: boolean;
        needs_onboarding: boolean;
      };
    }>('/v1/auth/gate');
    return response.data;
  }

  async completeOnboarding(input: {
    company_name: string;
    industry: string;
    size: string;
    goal: string;
  }) {
    const response = await this.request<{
      ok: true;
      data: {
        user: User;
        company: { id: string; name: string };
      };
    }>('/v1/onboarding/complete', {
      method: 'POST',
      body: input,
    });

    if (response.data.company) {
      await this.hydrateTenant(response.data.company);
    }

    return { user: response.data.user };
  }

  async login(email: string, password: string) {
    const response = await this.request<{
      ok: true;
      data: {
        session: {
          access_token: string;
          refresh_token: string;
        };
        user: User;
        company: { id: string; name: string } | null;
      };
    }>('/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    this.setSession({
      accessToken: response.data.session.access_token,
      refreshToken: response.data.session.refresh_token,
    });

    if (response.data.company) {
      await this.hydrateTenant(response.data.company);
    }

    return {
      user: response.data.user,
    };
  }

  async exchangeGoogleSession(input: {
    accessToken: string;
    refreshToken?: string;
    createIfMissing?: boolean;
    companyName?: string;
  }) {
    const response = await this.request<{
      ok: true;
      data: {
        session: {
          access_token: string;
          refresh_token: string | null;
        };
        user: User;
        company: { id: string; name: string } | null;
      };
    }>('/v1/auth/google/exchange', {
      method: 'POST',
      body: {
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
        create_if_missing: input.createIfMissing || false,
        company_name: input.companyName,
      },
    });

    const refreshToken = response.data.session.refresh_token || input.refreshToken || '';

    this.setSession({
      accessToken: response.data.session.access_token,
      refreshToken,
    });

    if (response.data.company) {
      await this.hydrateTenant(response.data.company);
    }

    return { user: response.data.user };
  }

  async logout() {
    this.setSession(null);
    localStorage.removeItem('tenant_defaults');
  }

  async getMe() {
    const response = await this.request<{ ok: true; data: { user: User } }>('/v1/auth/me');
    return response.data.user;
  }

  async getAdminOverview() {
    const response = await this.request<{ ok: true; data: AdminCompany[] }>('/v1/admin/companies');
    return { companies: response.data };
  }

  async setCompanyStatus(companyId: string, isActive: boolean) {
    const response = await this.request<{ ok: true; data: { id: string; is_active: boolean } }>(
      `/v1/admin/companies/${companyId}/status`,
      {
        method: 'PATCH',
        body: { is_active: isActive },
      }
    );

    return response.data;
  }

  async getAdminCompanyUsers(companyId: string) {
    const response = await this.request<{ ok: true; data: AdminUser[] }>(`/v1/admin/companies/${companyId}/users`);
    return response.data;
  }

  async registerCompany(input: {
    companyName: string;
    adminName: string;
    email: string;
    password: string;
    cvr?: string;
    address?: string;
    country?: string;
    phone?: string;
    companyEmail?: string;
    plan: string;
    userLimit?: number;
    paymentStatus?: 'pending' | 'active' | 'past_due' | 'cancelled' | 'trial';
  }) {
    const response = await this.request<{
      ok: true;
      data: {
        session: {
          access_token: string;
          refresh_token: string;
        };
        user: User;
        company: {
          id: string;
          name: string;
        };
      };
    }>('/v1/auth/signup-owner', {
      method: 'POST',
      body: {
        full_name: input.adminName,
        email: input.email,
        password: input.password,
        company: {
          name: input.companyName,
          cvr: input.cvr,
          address: input.address,
          country: input.country,
          phone: input.phone,
          email: input.companyEmail || input.email,
          plan: input.plan,
          user_limit: input.userLimit,
          payment_status: input.paymentStatus || 'pending',
        },
      },
    });

    this.setSession({
      accessToken: response.data.session.access_token,
      refreshToken: response.data.session.refresh_token,
    });

    const tenant = await this.hydrateTenant(response.data.company);

    return {
      tenant,
      user: response.data.user,
    };
  }

  async joinCompany(input: { invitationCode: string; name: string; email: string; password: string }) {
    const response = await this.request<{
      ok: true;
      data: {
        session: {
          access_token: string;
          refresh_token: string;
        };
        user: User;
        company: {
          id: string;
          name: string;
        };
      };
    }>('/v1/auth/signup-member', {
      method: 'POST',
      body: {
        invitation_code: input.invitationCode,
        full_name: input.name,
        email: input.email,
        password: input.password,
      },
    });

    this.setSession({
      accessToken: response.data.session.access_token,
      refreshToken: response.data.session.refresh_token,
    });

    const tenant = await this.hydrateTenant(response.data.company);

    return {
      tenant,
      user: response.data.user,
    };
  }

  async updateCompanySettings(input: {
    name?: string;
    cvr?: string | null;
    address?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    plan?: string;
    user_limit?: number | null;
    payment_status?: 'pending' | 'active' | 'past_due' | 'cancelled' | 'trial';
    language?: string;
    theme?: string;
  }) {
    const response = await this.request<{ ok: true; data: TenantSettings }>('/v1/company/settings', {
      method: 'PATCH',
      body: input,
    });
    return { tenant: response.data };
  }

  async getCompanySettings() {
    const response = await this.request<{ ok: true; data: TenantSettings }>('/v1/company/settings');
    return { tenant: response.data };
  }

  async regenerateInviteCode() {
    const response = await this.request<{ ok: true; data: { invite_code: string } }>('/v1/company/invite-code/regenerate', {
      method: 'POST',
    });
    return response.data;
  }

  async getCompanyUsers() {
    const response = await this.request<{
      ok: true;
      data: Array<{
        id: string;
        role: string;
        email: string;
        full_name: string | null;
        created_at: string;
      }>;
    }>('/v1/company/users');

    return response.data;
  }

  async updateCompanyUserRole(userId: string, role: string) {
    const response = await this.request<{ ok: true; data: { id: string; role: string } }>(
      `/v1/company/users/${userId}/role`,
      {
        method: 'PATCH',
        body: { role },
      }
    );

    return response.data;
  }

  async getRoles() {
    const response = await this.request<{
      ok: true;
      data: Array<{ slug: string; label: string; description: string | null; is_system: boolean }>;
    }>('/v1/roles');

    return response.data;
  }

  async validateInvitationCode(invitationCode: string) {
    const response = await this.request<{
      ok: true;
      data: {
        company_id: string;
        company_name: string;
        valid: boolean;
      };
    }>('/v1/auth/validate-invite-code', {
      method: 'POST',
      body: { invitation_code: invitationCode },
    });
    return response.data;
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
    triggerType: WorkflowTrigger;
    triggerConfig?: Record<string, unknown>;
    steps: Array<{ type: 'condition' | 'action' | 'delay'; config: Record<string, unknown>; stepOrder: number }>;
  }) {
    return this.request<{ data: Record<string, unknown> }>('/workflows', {
      method: 'POST',
      body: {
        name: input.name,
        trigger_type: input.triggerType,
        trigger_config: input.triggerConfig,
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
  async getInvoiceStats() {
    const r = await this.request<{ ok: true; data: InvoiceStats }>('/v1/invoices/stats');
    return r.data;
  }

  async getInvoices(params?: { status?: string }) {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    const q = search.toString() ? `?${search.toString()}` : '';
    const r = await this.request<{ ok: true; data: InvoiceSummary[] }>(`/v1/invoices${q}`);
    return r.data;
  }

  async getInvoice(id: string) {
    const r = await this.request<{ ok: true; data: InvoiceDetail }>(`/v1/invoices/${id}`);
    return r.data;
  }

  async createInvoice(input: CreateInvoiceInput) {
    const r = await this.request<{ ok: true; data: InvoiceDetail }>('/v1/invoices', {
      method: 'POST',
      body: input,
    });
    return r.data;
  }

  async updateInvoice(id: string, input: { status?: string; notes?: string }) {
    const r = await this.request<{ ok: true; data: InvoiceDetail }>(`/v1/invoices/${id}`, {
      method: 'PATCH',
      body: input,
    });
    return r.data;
  }

  // Payments
  async getPaymentStats() {
    const r = await this.request<{ ok: true; data: { count: number; total: number } }>('/v1/payments/stats');
    return r.data;
  }

  async getPayments() {
    const r = await this.request<{ ok: true; data: PaymentRecord[] }>('/v1/payments');
    return r.data;
  }

  async createPayment(input: {
    invoice_id?: string;
    amount: number;
    currency?: string;
    payment_date: string;
    payment_method: string;
    notes?: string;
  }) {
    const r = await this.request<{ ok: true; data: { ok: boolean } }>('/v1/payments', {
      method: 'POST',
      body: input,
    });
    return r.data;
  }

  // Gmail
  async getGmailStatus() {
    const r = await this.request<{ ok: true; data: { connected: boolean; gmail_email?: string; todo_sync_enabled?: boolean } }>('/v1/gmail/status');
    return r.data;
  }

  async getGmailAuthUrl() {
    const r = await this.request<{ ok: true; data: { auth_url: string } }>('/v1/gmail/auth');
    return r.data;
  }

  async getGmailMessages(folder?: string) {
    const q = folder ? `?folder=${folder}` : '';
    const r = await this.request<{ ok: true; data: GmailMessage[] }>(`/v1/gmail/messages${q}`);
    return r.data;
  }

  async sendGmailMessage(input: { to: string[]; subject: string; body: string; cc?: string[] }) {
    return this.request<{ ok: true; data: { ok: boolean } }>('/v1/gmail/send', {
      method: 'POST',
      body: input,
    });
  }

  async disconnectGmail() {
    return this.request<{ ok: true; data: { ok: boolean } }>('/v1/gmail/disconnect', { method: 'DELETE' });
  }

  async updateGmailSettings(settings: { todo_sync_enabled: boolean }) {
    return this.request<{ ok: true; data: { ok: boolean } }>('/v1/gmail/settings', {
      method: 'PATCH',
      body: settings,
    });
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

  // Emails
  async listEmails(params?: { folder?: string; q?: string; page?: number; limit?: number }) {
    const search = new URLSearchParams();
    if (params?.folder) search.set('folder', params.folder);
    if (params?.q) search.set('q', params.q);
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const query = search.toString() ? `?${search.toString()}` : '';
    return this.request<{ data: Email[]; meta: PaginationMeta }>(`/v1/emails${query}`);
  }

  async sendEmail(input: {
    to: string[];
    subject: string;
    body: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
  }) {
    return this.request<{ data: Email }>('/v1/emails/send', {
      method: 'POST',
      body: {
        to: input.to,
        subject: input.subject,
        body: input.body,
        cc: input.cc,
        bcc: input.bcc,
        reply_to: input.replyTo,
      },
    });
  }

  // Campaigns
  async listCampaigns() {
    return this.request<{ data: Campaign[] }>('/v1/campaigns');
  }

  async getCampaign(id: string) {
    return this.request<{ data: Campaign }>(`/v1/campaigns/${id}`);
  }

  async createCampaign(input: {
    name: string;
    subject: string;
    body: string;
    audienceFilter?: Record<string, unknown>;
    scheduledAt?: string;
  }) {
    return this.request<{ data: Campaign }>('/v1/campaigns', {
      method: 'POST',
      body: {
        name: input.name,
        subject: input.subject,
        body: input.body,
        audience_filter: input.audienceFilter,
        scheduled_at: input.scheduledAt,
      },
    });
  }

  async updateCampaign(id: string, input: { status?: 'draft' | 'scheduled' | 'sent' | 'cancelled'; name?: string }) {
    return this.request<{ data: Campaign }>(`/v1/campaigns/${id}`, {
      method: 'PATCH',
      body: input,
    });
  }

  // Todos
  async listTodos(params?: { status?: string; assignedTo?: string }) {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.assignedTo) search.set('assigned_to', params.assignedTo);
    const query = search.toString() ? `?${search.toString()}` : '';
    return this.request<{ data: Todo[] }>(`/v1/todos${query}`);
  }

  async createTodo(input: { title: string; description?: string; dueDate?: string; assignedTo?: string }) {
    return this.request<{ data: Todo }>('/v1/todos', {
      method: 'POST',
      body: {
        title: input.title,
        description: input.description,
        due_date: input.dueDate,
        assigned_to: input.assignedTo,
      },
    });
  }

  async updateTodo(id: string, input: { status?: string; title?: string; description?: string; dueDate?: string }) {
    return this.request<{ data: Todo }>(`/v1/todos/${id}`, {
      method: 'PATCH',
      body: {
        status: input.status,
        title: input.title,
        description: input.description,
        due_date: input.dueDate,
      },
    });
  }

  async deleteTodo(id: string) {
    return this.request<{ ok: true }>(`/v1/todos/${id}`, { method: 'DELETE' });
  }

  // ── AI Tasks ────────────────────────────────────────────────────────────────
  async listTasks(params?: { status?: string }) {
    const q = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
    return this.request<{ data: unknown[] }>(`/v1/tasks${q}`);
  }

  async createTask(input: { title: string; description?: string; priority?: string; deadline?: string }) {
    return this.request<{ data: unknown }>('/v1/tasks', { method: 'POST', body: input });
  }

  async approveTask(id: string) {
    return this.request<{ status: string }>(`/v1/tasks/${id}/approve`, { method: 'POST' });
  }

  async rejectTask(id: string) {
    return this.request<{ status: string }>(`/v1/tasks/${id}/reject`, { method: 'POST' });
  }

  async updateTask(id: string, input: { status?: string }) {
    return this.request<{ data: unknown }>(`/v1/tasks/${id}`, { method: 'PATCH', body: input });
  }

  async deleteTask(id: string) {
    return this.request<{ status: string }>(`/v1/tasks/${id}`, { method: 'DELETE' });
  }

  async generateAiTasks() {
    return this.request<{ created: number }>('/v1/tasks/ai-generate', { method: 'POST' });
  }

  // ── Email Campaigns ──────────────────────────────────────────────────────────
  async listEmailCampaigns() {
    return this.listCampaigns();
  }

  async createEmailCampaign(input: {
    name: string;
    subject: string;
    body: string;
    recipients: Array<{ email: string; name?: string }>;
    trackOpens?: boolean;
    trackReplies?: boolean;
  }) {
    return this.request<{ data: Campaign }>('/v1/campaigns', {
      method: 'POST',
      body: {
        name: input.name,
        subject: input.subject,
        body: input.body,
        recipients: input.recipients,
        track_opens: input.trackOpens,
        track_replies: input.trackReplies,
      },
    });
  }

  async sendEmailCampaign(campaignId: string) {
    return this.request<{ queued: number }>(`/v1/campaigns/${campaignId}/send`, { method: 'POST' });
  }

  async pauseEmailCampaign(campaignId: string) {
    return this.request<{ status: string }>(`/v1/campaigns/${campaignId}/pause`, { method: 'POST' });
  }

  async syncGmailInbox() {
    return this.request<{ synced: number }>('/v1/gmail/sync', { method: 'POST' });
  }

  // ── Meta Ads ─────────────────────────────────────────────────────────────────
  async getMetaCampaigns() {
    return this.request<{ data: unknown[] }>('/meta/campaigns');
  }

  async aiAnalyzeMeta(input: { campaignId?: string; question: string }) {
    return this.request<{ answer: string; suggestions: string[] }>('/meta/ai-analyze', {
      method: 'POST',
      body: input,
    });
  }

  async createMetaAd(input: {
    campaignId: string;
    adSetId: string;
    name: string;
    primaryText: string;
    headline: string;
    callToAction: string;
  }) {
    return this.request<{ data: unknown }>(`/meta/campaigns/${input.campaignId}/ads`, {
      method: 'POST',
      body: {
        ad_set_id: input.adSetId,
        name: input.name,
        primary_text: input.primaryText,
        headline: input.headline,
        call_to_action: input.callToAction,
      },
    });
  }

  // ── Video ad creative job system ────────────────────────────────────────────
  // The browser CANNOT run GPU inference directly — CUDA, PyTorch and heavy ML
  // models like InfiniteTalk / MuseTalk require a server-side GPU worker.
  // These methods submit jobs to the Railway backend which queues them for an
  // external GPU worker process (RunPod, Modal, or self-hosted). The frontend
  // polls getVideoJobStatus() until status === 'completed'.

  async submitVideoJob(input: {
    provider: 'infinitetalk' | 'musetalk' | 'skyreels' | 'realvideo';
    script: string;
    avatarUrl?: string;
    audioUrl?: string;
    ttsText?: string;
    durationSeconds: number;
    language: string;
    hookVariants?: string[];
    campaignId?: string;
    adSetId?: string;
    variantLabel?: string;
  }) {
    return this.request<{ job_id: string; status: string; estimated_seconds: number }>(
      '/meta/video-jobs',
      {
        method: 'POST',
        body: {
          provider: input.provider,
          script: input.script,
          avatar_url: input.avatarUrl,
          audio_url: input.audioUrl,
          tts_text: input.ttsText,
          duration_seconds: input.durationSeconds,
          language: input.language,
          hook_variants: input.hookVariants,
          campaign_id: input.campaignId,
          ad_set_id: input.adSetId,
          variant_label: input.variantLabel,
        },
      }
    );
  }

  async getVideoJobStatus(jobId: string) {
    return this.request<{
      job_id: string;
      status: 'queued' | 'processing' | 'completed' | 'failed';
      progress?: number;
      video_url?: string;
      thumbnail_url?: string;
      error?: string;
      provider: string;
      created_at: string;
      completed_at?: string;
    }>(`/meta/video-jobs/${jobId}`);
  }

  async listVideoJobs(campaignId?: string) {
    const q = campaignId ? `?campaign_id=${campaignId}` : '';
    return this.request<{
      data: Array<{
        job_id: string;
        status: 'queued' | 'processing' | 'completed' | 'failed';
        video_url?: string;
        thumbnail_url?: string;
        provider: string;
        script: string;
        variant_label?: string;
        created_at: string;
        hook_variants?: string[];
      }>;
    }>(`/meta/video-jobs${q}`);
  }

  async saveVideoAsAdCreative(jobId: string, input: {
    name: string;
    campaignId: string;
    adSetId?: string;
    variantLabel?: string;
  }) {
    return this.request<{ creative_id: string; status: string }>(
      `/meta/video-jobs/${jobId}/save-creative`,
      {
        method: 'POST',
        body: {
          name: input.name,
          campaign_id: input.campaignId,
          ad_set_id: input.adSetId,
          variant_label: input.variantLabel,
        },
      }
    );
  }

  async uploadVideoJobAsset(file: File, type: 'avatar' | 'audio' | 'video') {
    const token = this.getToken();
    const form = new FormData();
    form.append('file', file);
    form.append('asset_type', type);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/meta/video-assets/upload`, { method: 'POST', headers, body: form });
    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    return res.json() as Promise<{ url: string; asset_id: string }>;
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

  // ── AI Media Generation ───────────────────────────────────────────────────────

  async generateAiImage(params: {
    prompt: string;
    style?: string;
    aspectRatio?: string;
  }) {
    return this.request<AiGeneration>('/ai/generate/image', { method: 'POST', body: params });
  }

  async generateAiVideo(params: {
    prompt: string;
    duration?: number;
    style?: string;
    referenceImageUrl?: string;
  }) {
    return this.request<AiGeneration>('/ai/generate/video', { method: 'POST', body: params });
  }

  async listAiGenerations(params?: { type?: 'image' | 'video'; status?: string }) {
    const q = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<{ data: AiGeneration[] }>(`/ai/generations${q}`);
  }

  async getAiGenerationStatus(id: string) {
    return this.request<AiGeneration>(`/ai/generations/${id}`);
  }

  async deleteAiGeneration(id: string) {
    return this.request<{ success: boolean }>(`/ai/generations/${id}`, { method: 'DELETE' });
  }

  async getAiUsageStats() {
    return this.request<AiUsageStats>('/ai/usage/stats');
  }

  async getAdminAiUsage() {
    return this.request<{
      companies: AdminAiCompanyUsage[];
      serverStatus: 'online' | 'offline' | 'degraded';
      totalToday: number;
      failedToday: number;
    }>('/admin/ai/usage');
  }
}

// Types
export interface User {
  id: string;
  email: string;
  role: string | null;
  full_name?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  permissions?: string[];
  is_global_admin?: boolean;
  onboarding_completed?: boolean;
  needs_onboarding?: boolean;

  // Legacy compatibility
  name?: string;
}

export interface TenantSettings {
  id: string;
  name: string;
  cvr?: string | null;
  address?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  plan: string;
  user_limit?: number | null;
  payment_status: 'pending' | 'active' | 'past_due' | 'cancelled' | 'trial' | string;
  invite_code?: string | null;
  is_active: boolean;
  created_at: string;

  // Legacy compatibility
  join_code?: string;
  default_language?: string;
  default_theme?: string;
}

export interface AdminCompany {
  id: string;
  name: string;
  plan: string;
  payment_status: string;
  is_active: boolean;
  created_at: string;
  user_count: number;

  // Legacy compatibility
  joinCode?: string;
  defaultLanguage?: string;
  defaultTheme?: string;
  userCount?: number;
  createdAt?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  full_name?: string | null;
  company_id?: string;
  created_at: string;

  // Legacy compatibility
  name?: string;
  email_verified?: boolean;
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

export interface InvoiceStats {
  sent: number;
  paid: number;
  draft: number;
  overdue: number;
  total_sent_amount: number;
  total_paid_amount: number;
}

export interface InvoiceSummary {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  customer_name: string;
  customer_country: string;
  currency: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  payment_method: string | null;
  created_at: string;
}

export interface NewInvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order: number;
}

export interface InvoiceDetail extends InvoiceSummary {
  customer_address: string | null;
  customer_type: string;
  customer_cvr: string | null;
  customer_vat: string | null;
  customer_email: string | null;
  vat_rate: number;
  vat_note: string | null;
  payment_terms_days: number;
  bank_account: string | null;
  notes: string | null;
  lead_id: string | null;
  deal_id: string | null;
  items: NewInvoiceItem[];
}

export interface CreateInvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface CreateInvoiceInput {
  invoice_date: string;
  due_date: string;
  delivery_date?: string;
  customer_name: string;
  customer_address?: string;
  customer_country: string;
  customer_type: 'company' | 'private';
  customer_cvr?: string;
  customer_vat?: string;
  customer_email?: string;
  currency: string;
  vat_rate: number;
  vat_note?: string;
  payment_method: string;
  payment_terms_days: number;
  bank_account?: string;
  notes?: string;
  lead_id?: string;
  deal_id?: string;
  items: CreateInvoiceItem[];
}

export interface PaymentRecord {
  id: string;
  company_id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface GmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  read: boolean;
  labels: string[];
  internalDate: string;
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

export interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  folder: string;
  read: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  audienceFilter?: Record<string, unknown>;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'done' | 'cancelled';
  dueDate?: string;
  assignedTo?: string;
  createdAt: string;
}

// ── Workflow types ─────────────────────────────────────────────────────────────

export type WorkflowTrigger =
  | 'new_lead_created'
  | 'lead_status_changed'
  | 'lead_score_changed'
  | 'new_employee_created'
  | 'invoice_overdue'
  | 'invoice_paid'
  | 'task_completed'
  | 'campaign_sent'
  | 'integration_connected'
  | 'manual_trigger';

export type WorkflowAction =
  | 'create_task'
  | 'send_email'
  | 'send_notification'
  | 'update_lead_status'
  | 'send_webhook'
  | 'generate_ai_content'
  | 'send_invitation_email';

// ── AI Generation types ────────────────────────────────────────────────────────

export interface AiGeneration {
  id: string;
  type: 'image' | 'video';
  prompt: string;
  style?: string;
  aspectRatio?: string;
  duration?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
  companyId: string;
  userId: string;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface AiUsageStats {
  totalImages: number;
  totalVideos: number;
  totalCompleted: number;
  totalFailed: number;
  totalPending: number;
  recentGenerations: AiGeneration[];
}

export interface AdminAiCompanyUsage {
  companyId: string;
  companyName: string;
  totalImages: number;
  totalVideos: number;
  failedCount: number;
  lastActivityAt?: string;
}

export const api = new ApiClient();

// Aliases for backward compatibility
export const apiClient = api;
export const adminApi = api;

// Lead and Task types re-exported from crm types
export type { Lead, Task } from '@/lib/crm/types';
