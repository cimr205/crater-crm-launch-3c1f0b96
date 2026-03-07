// Re-exports from the canonical Lovable integration path.
// Import supabase client from here or directly from '@/integrations/supabase/client'.
export { supabase } from '@/integrations/supabase/client';
export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from '@/integrations/supabase/types';

export function getOAuthRedirectTo(locale: string): string {
  return `${window.location.origin}/${locale}/auth/callback`;
}
