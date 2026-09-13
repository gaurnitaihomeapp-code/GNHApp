import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as unknown as { env?: Record<string, any> }).env || {};
const dataEnv = (typeof env.VITE_DATA_ENV === 'string' ? env.VITE_DATA_ENV : '').trim().toLowerCase();
const isDev = Boolean(env.DEV);
const rawSupabaseUrl = env.VITE_SUPABASE_URL || '';
const rawSupabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';
const allowProdInDev = env.VITE_ALLOW_PROD_IN_DEV === 'true';

// Known production Supabase host to guard against accidental live writes from localhost
const KNOWN_PROD_HOST = 'qzizwubxygmrargsohkl.supabase.co';

export let supabase: SupabaseClient | null = null;

// Determine whether we should connect to Supabase
const isExplicitLocal = dataEnv === 'local';
const isHittingProductionFromDev = isDev && rawSupabaseUrl.includes(KNOWN_PROD_HOST) && !allowProdInDev;
const shouldConnectSupabase = !isExplicitLocal && !isHittingProductionFromDev && Boolean(rawSupabaseUrl && rawSupabaseAnonKey);

if (isHittingProductionFromDev) {
  console.warn(
    '[GNH App] Production Supabase URL detected in local development. Live cloud connection blocked to protect production data. Operating in isolated Local Data mode.'
  );
}

if (shouldConnectSupabase) {
  try {
    supabase = createClient(rawSupabaseUrl, rawSupabaseAnonKey);
    console.info('[GNH App] Connected to Supabase Cloud Database.');
  } catch (error) {
    console.warn('Supabase initialization failed:', error);
    supabase = null;
  }
} else {
  console.info('[GNH App] Operating in isolated Local Data mode.');
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabase);
}

export function isLocalDataMode(): boolean {
  return !isSupabaseConfigured();
}

export function getDataEnvironmentInfo(): {
  isLocal: boolean;
  isProduction: boolean;
  mode: string;
  storageType: 'local_storage' | 'supabase_cloud';
  supabaseUrl?: string;
} {
  const isLocal = isLocalDataMode();
  return {
    isLocal,
    isProduction: !isLocal,
    mode: isLocal ? 'Local Development' : 'Production Cloud',
    storageType: isLocal ? 'local_storage' : 'supabase_cloud',
    supabaseUrl: isLocal ? undefined : rawSupabaseUrl,
  };
}

export function reconfigureSupabase(url: string, key: string): boolean {
  try {
    if (!url || !key) {
      supabase = null;
      return false;
    }
    supabase = createClient(url, key);
    return true;
  } catch (error) {
    console.error('Failed to configure Supabase:', error);
    return false;
  }
}
