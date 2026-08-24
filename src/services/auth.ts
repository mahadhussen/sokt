// Authentication edge. An account is optional: Sökt works fully without one,
// and signing in exists to move a participant's own data between devices.
//
// The 6-digit code is Supabase Auth's `signInWithOtp` / `verifyOtp`, with the
// mail delivered by Resend as Supabase's SMTP provider. We deliberately do not
// generate, store, or check codes ourselves — rate limiting, brute-force
// protection, token refresh and session storage are exactly the parts that are
// easy to get subtly and dangerously wrong.
//
// supabase-js is loaded lazily and only when an account is actually used, so
// the local-only app carries none of its weight.

import { getSupabase, supabaseConfigured } from './supabaseClient'

export interface Account {
  id: string
  email: string
}

export interface AuthPort {
  // False when this build has no Supabase project configured. The UI hides the
  // account section entirely rather than offering a door that opens onto
  // nothing.
  readonly configured: boolean
  currentAccount(): Promise<Account | null>
  sendCode(email: string): Promise<void>
  verifyCode(email: string, code: string): Promise<Account>
  signOut(): Promise<void>
  // Whoever can create an account must be able to remove it, in the app,
  // without emailing anyone. Without this "delete" is a claim, not a feature.
  deleteAccount(): Promise<void>
}

export function authConfigured(): boolean {
  return supabaseConfigured()
}

// Used when no project is configured. Every call fails loudly rather than
// pretending to work — a silent no-op here would look like a lost account.
export function createDisabledAuth(): AuthPort {
  const off = () => Promise.reject(new Error('Inloggning är inte konfigurerad i den här versionen'))
  return {
    configured: false,
    currentAccount: () => Promise.resolve(null),
    sendCode: off,
    verifyCode: off,
    signOut: () => Promise.resolve(),
    deleteAccount: off,
  }
}

// Supabase speaks English and leaks implementation detail. The participant
// gets a sentence that tells them what to do next.
function readable(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('expired') || m.includes('invalid') || m.includes('token')) {
    return 'Fel eller för gammal kod. Be om en ny kod och försök igen.'
  }
  if (m.includes('rate') || m.includes('too many') || m.includes('limit')) {
    return 'För många försök. Vänta en stund och försök igen.'
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Ingen kontakt med servern. Kontrollera din uppkoppling.'
  }
  return 'Något gick fel med inloggningen. Försök igen.'
}

function toAccount(user: { id: string; email?: string } | null): Account | null {
  return user ? { id: user.id, email: user.email ?? '' } : null
}

export function createSupabaseAuth(): AuthPort {
  return {
    configured: true,

    async currentAccount() {
      try {
        const { data } = await (await getSupabase()).auth.getSession()
        return toAccount(data.session?.user ?? null)
      } catch {
        // A failed session lookup must never block boot; the app simply runs
        // as it does for everyone without an account.
        return null
      }
    },

    async sendCode(email) {
      const { error } = await (await getSupabase()).auth.signInWithOtp({
        email,
        // Sökt is open to anyone: a first sign-in creates the account.
        options: { shouldCreateUser: true },
      })
      if (error) throw new Error(readable(error.message))
    },

    async verifyCode(email, code) {
      const { data, error } = await (await getSupabase()).auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      })
      if (error) throw new Error(readable(error.message))
      const account = toAccount(data.user)
      if (!account) throw new Error(readable('invalid'))
      return account
    },

    async signOut() {
      const { error } = await (await getSupabase()).auth.signOut()
      if (error) throw new Error(readable(error.message))
    },

    async deleteAccount() {
      const db = await getSupabase()
      // A SECURITY DEFINER function in the database: the anon key must never
      // touch auth.users, and the function reads auth.uid() from the JWT, so
      // one user cannot ask for another user's account to be removed.
      const { error } = await db.rpc('delete_own_account')
      if (error) throw new Error(readable(error.message))
      // The session is now pointing at a user that no longer exists; clear it
      // so the app does not keep trying to sync to a deleted account.
      await db.auth.signOut().catch(() => undefined)
    },
  }
}

export function defaultAuth(): AuthPort {
  return authConfigured() ? createSupabaseAuth() : createDisabledAuth()
}
