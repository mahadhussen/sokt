// Klientsidan av ansökningsutskicket: postar till vår serverfunktion som
// bifogar CV:t och skickar via Resend. Servern läser namn, svarsadress och CV
// ur kontots egna rader — här skickas bara det som varierar per ansökan.

import { getSupabase } from './supabaseClient'

const ENDPOINT = '/api/send-application'

let configured: boolean | null = null

// Är utskick påslaget på servern (Resend-nyckel satt)? Svaret ändras inte
// under en session, så det räcker att fråga en gång.
export async function sendMailConfigured(): Promise<boolean> {
  if (configured !== null) return configured
  try {
    const resp = await fetch(ENDPOINT)
    const data = (await resp.json()) as { configured?: boolean }
    configured = Boolean(data.configured)
  } catch {
    configured = false
  }
  return configured
}

export async function sendApplicationEmail(input: {
  to: string
  subject: string
  text: string
}): Promise<void> {
  const db = await getSupabase()
  const { data } = await db.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Inte inloggad.')
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  if (!resp.ok) {
    const body = (await resp.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `Utskicket misslyckades (${resp.status}).`)
  }
}
