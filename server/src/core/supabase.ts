import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

if (!env.supabaseUrl || !env.supabaseAnonKey || !env.supabaseServiceRoleKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars missing: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAnon = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
