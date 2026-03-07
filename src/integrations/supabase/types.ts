export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          cvr: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          website: string | null;
          plan: string;
          payment_status: 'pending' | 'active' | 'past_due' | 'cancelled' | 'trial';
          is_active: boolean;
          invite_code: string | null;
          user_limit: number | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          company_id: string | null;
          full_name: string | null;
          email: string;
          role: string;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      leads: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          company_name: string | null;
          status: 'new' | 'contacted' | 'qualified' | 'disqualified';
          notes: string | null;
          score: number | null;
          value: number | null;
          source: 'email' | 'call' | 'import' | 'manual' | null;
          owner_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['leads']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['leads']['Insert']>;
      };
      invitations: {
        Row: {
          id: string;
          company_id: string;
          email: string;
          token: string;
          status: 'pending' | 'accepted' | 'expired';
          created_at: string;
          expires_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['invitations']['Row'], 'id' | 'created_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['invitations']['Insert']>;
      };
      user_roles: {
        Row: {
          user_id: string;
          company_id: string;
          role: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_roles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_invitation: {
        Args: { invite_email: string };
        Returns: string;
      };
      get_company_status: {
        Args: { _company_id: string };
        Returns: {
          status: string;
          mode: string;
          compliance_checklist: Json;
        }[];
      };
      update_compliance_item: {
        Args: { _company_id: string; _item: string; _value: boolean };
        Returns: void;
      };
      activate_company: {
        Args: { _company_id: string };
        Returns: void;
      };
      set_company_mode: {
        Args: { _company_id: string; _mode: string };
        Returns: void;
      };
    };
    Enums: {
      lead_status: 'new' | 'contacted' | 'qualified' | 'disqualified';
      lead_source: 'email' | 'call' | 'import' | 'manual';
      invitation_status: 'pending' | 'accepted' | 'expired';
      payment_status: 'pending' | 'active' | 'past_due' | 'cancelled' | 'trial';
    };
  };
};

// Convenience type aliases
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
