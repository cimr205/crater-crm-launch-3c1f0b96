const API_BASE_URL = 'https://crater-crm-launch-production.up.railway.app/api/v1';

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
  id: number;
  name: string;
  email: string;
  role: string;
  company?: {
    name: string;
  };
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
