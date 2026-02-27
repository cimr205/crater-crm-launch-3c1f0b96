import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL ||
  'https://llxtjtiwocoztokwgsjc.supabase.co';

const supabaseAnonKey =
  (import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxseHRqdGl3b2NvenRva3dnc2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Nzc0MTcsImV4cCI6MjA4NDA1MzQxN30.R1Q3OKGbypXEcfUmBvLgzIgx-_w2q63O9z1l4OaWm6k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getOAuthRedirectTo(locale: string): string {
  return `${window.location.origin}/${locale}/auth/callback`;
}
