const API_BASE_URL = 'https://api.aiagencydanmark.dk/api';
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

export const api = new ApiClient();
