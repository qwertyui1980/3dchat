import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_PROJECT_URL = 'https://zhlhyasefzwnecszazlf.supabase.co';

let supabaseInstance: SupabaseClient | null = null;

export function getEffectiveSupabaseUrl(): string {
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('xstreamx_supabase_url');
    if (customUrl && customUrl.trim()) return customUrl.trim();
  }
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }
  return DEFAULT_SUPABASE_PROJECT_URL;
}

export function getEffectiveSupabaseAnonKey(): string {
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  if (typeof window !== 'undefined') {
    return localStorage.getItem('xstreamx_supabase_anon_key') || '';
  }
  return '';
}

export function isValidSupabaseKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  return trimmed.length > 20 && trimmed.startsWith('eyJ') && trimmed.split('.').length === 3;
}

export function isSupabaseConfigured(): boolean {
  const url = getEffectiveSupabaseUrl();
  const key = getEffectiveSupabaseAnonKey();
  return !!(url && isValidSupabaseKey(key));
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = getEffectiveSupabaseUrl();
  const key = getEffectiveSupabaseAnonKey();

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

export function setSupabaseConfig(url?: string, anonKey?: string) {
  if (typeof window !== 'undefined') {
    if (url && url.trim() && url.trim() !== DEFAULT_SUPABASE_PROJECT_URL) {
      localStorage.setItem('xstreamx_supabase_url', url.trim());
    } else {
      localStorage.removeItem('xstreamx_supabase_url');
    }

    if (anonKey && anonKey.trim()) {
      localStorage.setItem('xstreamx_supabase_anon_key', anonKey.trim());
    } else if (anonKey !== undefined) {
      localStorage.removeItem('xstreamx_supabase_anon_key');
    }

    supabaseInstance = null;
  }
}

export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      message: 'Falta la clave Anon Key válida (JWT formato eyJ...) para conectar con Supabase.',
    };
  }

  try {
    const { error } = await client.from('rooms').select('id').limit(1);
    if (error) {
      return {
        ok: false,
        message: `Error al consultar Supabase: ${error.message}`,
      };
    }
    return {
      ok: true,
      message: 'Conexión a Supabase Cloud exitosa y lista para sincronización en tiempo real.',
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error de red o timeout contactando con Supabase.',
    };
  }
}

export const SUPABASE_URL = DEFAULT_SUPABASE_PROJECT_URL;

