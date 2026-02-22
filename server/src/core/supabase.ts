import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

type SupabaseClient = ReturnType<typeof createClient>;

const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceRoleKey);

if (!hasSupabaseConfig) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars missing: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
}

function createMissingClient(clientName: 'supabaseAnon' | 'supabaseAdmin'): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(
        `Supabase client ${clientName} is unavailable because SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are not configured.`
      );
    },
  });
}

export const supabaseAnon: SupabaseClient = hasSupabaseConfig
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : createMissingClient('supabaseAnon');

export const supabaseAdmin: SupabaseClient = hasSupabaseConfig
  ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : createMissingClient('supabaseAdmin');
