// Skapar ett utkast i ANVÄNDARENS egen Gmail via Gmail API.
//
// Förutsätter att användaren loggat in i Sökt med Google och godkänt
// behörigheten gmail.compose — då ligger en access-token i Supabase-sessionen
// (provider_token). Utkastet hamnar i deras Utkast-mapp; ingenting skickas
// förrän de själva trycker Skicka i Gmail. Det är hela poängen: appen
// förbereder, människan beslutar.

import { getSupabase } from './supabaseClient'
import { draftRaw } from '../apply/gmailMime'
import type { DraftInput } from '../apply/gmailMime'

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose'

// Google-tokenen ur sessionen. null = användaren har inte kopplat Google
// (eller tokenen har gått ut — den lever ca en timme).
export async function googleToken(): Promise<string | null> {
  const { data } = await (await getSupabase()).auth.getSession()
  return data.session?.provider_token ?? null
}

// Skickar användaren till Googles samtyckesskärm och tillbaka hit.
// prompt=consent gör att en utgången token kan förnyas genom att koppla om.
export async function connectGoogle(): Promise<void> {
  const { error } = await (await getSupabase()).auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: `${GMAIL_SCOPE} email`,
      redirectTo: window.location.origin,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
  if (error) {
    throw new Error(
      'Google-inloggning är inte påslagen för Sökt än. Se GMAIL_SETUP.md i repot.',
    )
  }
}

export async function createGmailDraft(token: string, input: DraftInput): Promise<void> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw: draftRaw(input) } }),
  })
  if (res.status === 401 || res.status === 403) {
    // Tokenen är utgången eller behörigheten saknas. Begripligt nästa steg,
    // inte ett API-felmeddelande på engelska.
    throw new Error('Gmail-kopplingen har gått ut. Koppla Google igen så fortsätter det fungera.')
  }
  if (!res.ok) {
    throw new Error(`Kunde inte skapa utkastet i Gmail (${res.status}). Försök igen.`)
  }
}
