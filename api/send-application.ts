// Skickar en ansökan med CV:t bifogat på riktigt, via Resend.
//
// Varför server-side: en mejllänk (mailto/Gmail/Outlook) kan aldrig bifoga en
// fil, och en nedladdningslänk i brödtexten ser oseriös ut för arbetsgivare.
// Gmail-API-vägen kräver per-användare-OAuth och Googles granskning för fler än
// 100 användare — ohållbart att sälja. Resend från vår verifierade domän
// fungerar för varje deltagare oavsett mejlleverantör.
//
// Säkerhet:
// - Kräver deltagarens egen Supabase-JWT. Namn, svarsadress och CV läses ur
//   deltagarens egen profil/bucket MED deltagarens token (RLS avgör ägarskap)
//   — klienten kan aldrig skicka i någon annans namn eller med någon annans CV.
// - Ingen service_role någonstans.
// - Dagstak per konto (sokt_send_log, RLS) så adressen inte kan missbrukas
//   som spamrelä av ett inloggat konto.
// - Svar går till deltagaren (reply_to) och deltagaren får en kopia (bcc).

interface Req {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
interface Res {
  status(code: number): Res
  json(body: unknown): void
  setHeader(name: string, value: string): void
}

const DAILY_LIMIT = 20
const MAX_TEXT = 20_000
const MAX_SUBJECT = 200

const env = (name: string) => process.env[name] ?? ''
const supabaseUrl = () => env('VITE_SOKT_SUPABASE_URL').replace(/\/$/, '')
const anonKey = () => env('VITE_SOKT_SUPABASE_ANON_KEY')
const mailFrom = () => env('SOKT_MAIL_FROM') || 'ansokan@arbetsklivet.se'

function authHeaders(token: string): Record<string, string> {
  return { apikey: anonKey(), Authorization: `Bearer ${token}` }
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    res.status(200).json({ configured: Boolean(env('RESEND_API_KEY') && supabaseUrl()) })
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!env('RESEND_API_KEY') || !supabaseUrl() || !anonKey()) {
    res.status(503).json({ error: 'Mejlutskick är inte konfigurerat.' })
    return
  }

  const auth = req.headers.authorization
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) {
    res.status(401).json({ error: 'Inte inloggad.' })
    return
  }

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as {
    to?: unknown
    subject?: unknown
    text?: unknown
  }
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const text = typeof body.text === 'string' ? body.text : ''
  if (!isEmail(to) || !subject || !text) {
    res.status(400).json({ error: 'Mottagare, ämne och text krävs.' })
    return
  }
  if (subject.length > MAX_SUBJECT || text.length > MAX_TEXT) {
    res.status(400).json({ error: 'Mejlet är för långt.' })
    return
  }

  // 1. Vem är det? Token verifieras av Supabase, inte av oss.
  const userResp = await fetch(`${supabaseUrl()}/auth/v1/user`, { headers: authHeaders(token) })
  if (!userResp.ok) {
    res.status(401).json({ error: 'Inloggningen har gått ut. Logga in igen.' })
    return
  }
  const user = (await userResp.json()) as { id?: string }
  if (!user.id) {
    res.status(401).json({ error: 'Inloggningen har gått ut. Logga in igen.' })
    return
  }

  // 2. Deltagarens egen profil — namn, svarsadress, CV-filnamn. RLS ger bara
  // den egna raden, så avsändaridentiteten kan inte väljas av klienten.
  const profResp = await fetch(
    `${supabaseUrl()}/rest/v1/profiles?select=first_name,last_name,email,cv_file_name`,
    { headers: authHeaders(token) },
  )
  const profRows = profResp.ok ? ((await profResp.json()) as Array<Record<string, string | null>>) : []
  const prof = profRows[0]
  const replyTo = prof?.email && isEmail(prof.email) ? prof.email : null
  const cvFileName = prof?.cv_file_name || null
  if (!replyTo) {
    res.status(400).json({ error: 'Fyll i din mejladress under Profil först.' })
    return
  }
  if (!cvFileName) {
    res.status(400).json({ error: 'Inget CV på kontot. Ladda upp det under Profil först.' })
    return
  }
  const fullName = [prof?.first_name, prof?.last_name].filter(Boolean).join(' ').trim()

  // 3. Dagstak. Räkna först, logga sedan — taket ska inte gå att rusa förbi
  // med parallella anrop i någon större grad än loggfönstret tillåter.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const countResp = await fetch(
    `${supabaseUrl()}/rest/v1/sokt_send_log?select=id&sent_at=gte.${encodeURIComponent(since)}`,
    { headers: { ...authHeaders(token), Prefer: 'count=exact', Range: '0-0' } },
  )
  const contentRange = countResp.headers.get('content-range') ?? ''
  const total = Number(contentRange.split('/')[1] ?? 0)
  if (Number.isFinite(total) && total >= DAILY_LIMIT) {
    res.status(429).json({ error: `Max ${DAILY_LIMIT} ansökningar per dygn. Försök igen i morgon.` })
    return
  }

  // 4. CV:t ur deltagarens egen mapp i bucketen, med deltagarens token.
  const cvResp = await fetch(
    `${supabaseUrl()}/storage/v1/object/authenticated/cvs/${user.id}/cv`,
    { headers: authHeaders(token) },
  )
  if (!cvResp.ok) {
    res.status(400).json({ error: 'CV:t kunde inte hämtas. Ladda upp det igen under Profil.' })
    return
  }
  const cvBytes = Buffer.from(await cvResp.arrayBuffer())
  if (cvBytes.length > 10 * 1024 * 1024) {
    res.status(400).json({ error: 'CV:t är för stort att bifoga (max 10 MB).' })
    return
  }

  // 5. Skicka. Avsändarnamnet är deltagarens riktiga namn; adressen är vår
  // verifierade domän; svar går rakt till deltagaren; kopia till deltagaren.
  const from = fullName ? `${fullName} via Sökt <${mailFrom()}>` : `Sökt <${mailFrom()}>`
  const sendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo,
      bcc: [replyTo],
      subject,
      text,
      attachments: [{ filename: cvFileName, content: cvBytes.toString('base64') }],
    }),
  })
  if (!sendResp.ok) {
    const detail = await sendResp.text().catch(() => '')
    res.status(502).json({ error: `Mejlet kunde inte skickas (${sendResp.status}). ${detail.slice(0, 200)}` })
    return
  }

  // 6. Logga för dagstaket. Misslyckas loggningen har mejlet ändå gått — det
  // får aldrig se ut som ett fel för deltagaren.
  await fetch(`${supabaseUrl()}/rest/v1/sokt_send_log`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: user.id, to_email: to }),
  }).catch(() => undefined)

  res.status(200).json({ ok: true })
}
