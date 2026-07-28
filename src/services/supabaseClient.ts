// The one Supabase client, created lazily.
//
// Lazy matters: supabase-js is the largest dependency in the project, and Sökt
// works fully without an account. Someone who never signs in must never
// download it, so the import lives behind a call that only the account and
// sync paths make.

import type { SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL: string = import.meta.env.VITE_SOKT_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SOKT_SUPABASE_ANON_KEY ?? ''

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

let clientPromise: Promise<SupabaseClient> | null = null

export function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseConfigured()) {
    return Promise.reject(new Error('Inloggning är inte konfigurerad i den här versionen'))
  }
  clientPromise ??= import('@supabase/supabase-js').then((m) =>
    m.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // No magic links, so there is never a token in the address bar.
        detectSessionInUrl: false,
        storageKey: 'sokt.auth.v1',
      },
    }),
  )
  return clientPromise
}
