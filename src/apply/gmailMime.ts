// Bygger RFC822-meddelandet för ett Gmail-utkast. Ren modul: inga imports
// från ui, render, services eller app.
//
// Gmail API tar hela mejlet som en base64url-kodad rå MIME-sträng. Brevtexten
// är UTF-8 (å/ä/ö, arabiska, somaliska) och CV:t är binärt — båda måste därför
// base64-kodas som egna MIME-delar så att strängen som helhet är ren ASCII.

export interface DraftInput {
  to: string
  subject: string
  textBody: string
  attachment?: {
    filename: string
    mimeType: string
    // Redan base64-kodad (fileStore.blobToBase64 levererar detta).
    contentBase64: string
  }
}

// RFC 2047: ett ämne med tecken utanför ASCII måste ordkodas, annars
// förvanskas "Ansökan" till mojibake hos mottagaren.
export function encodeSubject(subject: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) return subject
  const bytes = new TextEncoder().encode(subject)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `=?UTF-8?B?${btoa(bin)}?=`
}

// UTF-8-text → base64 (btoa klarar bara Latin1, därför via TextEncoder).
export function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

// Base64 → base64url, som Gmail API kräver för `raw`.
export function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Radbryt base64 till 76 tecken per rad (RFC 2045 kräver ≤ 998; 76 är norm).
function wrap76(b64: string): string {
  return b64.replace(/(.{76})/g, '$1\r\n')
}

export function buildDraftMime(input: DraftInput): string {
  const subject = encodeSubject(input.subject)
  const textPart = wrap76(base64Utf8(input.textBody))

  if (!input.attachment) {
    return [
      `To: ${input.to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      textPart,
    ].join('\r\n')
  }

  // Gränsen får inte kunna dyka upp i base64-innehåll: '=' ingår aldrig i
  // base64-alfabetets mitt och '_SOKT_' gör den unik nog utan slump (ren modul
  // — determinism gör den testbar).
  const boundary = '=_SOKT_BOUNDARY_='
  const att = input.attachment
  return [
    `To: ${input.to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    textPart,
    `--${boundary}`,
    `Content-Type: ${att.mimeType}; name="${att.filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${att.filename}"`,
    '',
    wrap76(att.contentBase64),
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

// Hela paketet: MIME → base64url, redo för POST till Gmail API.
export function draftRaw(input: DraftInput): string {
  return toBase64Url(base64Utf8(buildDraftMime(input)))
}
