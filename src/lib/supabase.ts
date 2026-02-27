import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getOAuthRedirectTo(locale: string): string {
  return `${window.location.origin}/${locale}/auth/callback`;
}
