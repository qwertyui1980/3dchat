import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_PROJECT_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://zhlhyasefzwnecszazlf.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (typeof window !== 'undefined'
    ? localStorage.getItem('xstreamx_supabase_anon_key') || ''
    : '');

let supabaseInstance: SupabaseClient | null = null;

export function isValidSupabaseKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  return trimmed.length > 20 && trimmed.startsWith('eyJ') && trimmed.split('.').length === 3;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = SUPABASE_PROJECT_URL;
  const key =
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('xstreamx_supabase_anon_key') || ''
      : '');

  if (url && isValidSupabaseKey(key)) {
    try {
      supabaseInstance = createClient(url, key.trim(), {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return supabaseInstance;
    } catch (e) {
      console.warn('[Supabase] Failed to initialize client:', e);
      return null;
    }
  }

  return null;
}

export function setSupabaseAnonKey(key: string) {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem('xstreamx_supabase_anon_key', key.trim());
    } else {
      localStorage.removeItem('xstreamx_supabase_anon_key');
    }
    supabaseInstance = null; // Recreate on next call
  }
}

export const SUPABASE_URL = SUPABASE_PROJECT_URL;
