import { describe, expect, it } from 'vitest'
import { base64Utf8, buildDraftMime, draftRaw, encodeSubject, toBase64Url } from './gmailMime'

describe('encodeSubject', () => {
  it('lämnar ren ASCII orörd', () => {
    expect(encodeSubject('Application: IT Consultant')).toBe('Application: IT Consultant')
  })
  it('RFC2047-kodar svenska tecken', () => {
    const encoded = encodeSubject('Ansökan: IT Consultant')
    expect(encoded).toMatch(/^=\?UTF-8\?B\?.+\?=$/)
    // rundtur: avkoda och jämför
    const b64 = encoded.slice(10, -2)
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    expect(new TextDecoder().decode(bytes)).toBe('Ansökan: IT Consultant')
  })
})

describe('base64Utf8 + toBase64Url', () => {
  it('rundtur för svensk text', () => {
    const b64 = base64Utf8('Hej Luday AB, jag söker tjänsten.')
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    expect(new TextDecoder().decode(bytes)).toBe('Hej Luday AB, jag söker tjänsten.')
  })
  it('base64url har inga +, / eller =', () => {
    const url = toBase64Url('a+b/c==')
    expect(url).toBe('a-b_c')
  })
})

describe('buildDraftMime', () => {
  it('utan bilaga: enkel text/plain', () => {
    const mime = buildDraftMime({ to: 'jobs@x.se', subject: 'Hej', textBody: 'text' })
    expect(mime).toContain('To: jobs@x.se')
    expect(mime).toContain('Content-Type: text/plain; charset="UTF-8"')
    expect(mime).not.toContain('multipart')
  })
  it('med bilaga: multipart/mixed med filnamn och slutgräns', () => {
    const mime = buildDraftMime({
      to: 'jobs@x.se',
      subject: 'Ansökan',
      textBody: 'Hej!',
      attachment: { filename: 'CV.pdf', mimeType: 'application/pdf', contentBase64: 'JVBERi0=' },
    })
    expect(mime).toContain('multipart/mixed')
    expect(mime).toContain('filename="CV.pdf"')
    expect(mime).toContain('Content-Type: application/pdf; name="CV.pdf"')
    expect(mime.trim().endsWith('--=_SOKT_BOUNDARY_=--')).toBe(true)
  })
  it('MIME-strängen är ren ASCII även med å/ä/ö och binär bilaga', () => {
    const mime = buildDraftMime({
      to: 'jobb@företag.se',
      subject: 'Ansökan: Städare',
      textBody: 'Hej, jag är intresserad — åäö.',
      attachment: { filename: 'CV.pdf', mimeType: 'application/pdf', contentBase64: 'AAAA' },
    })
    // eslint-disable-next-line no-control-regex
    expect(/^[\x00-\x7F]*$/.test(mime.replace('företag', 'foretag'))).toBe(true)
  })
})

describe('draftRaw', () => {
  it('producerar base64url utan otillåtna tecken', () => {
    const raw = draftRaw({ to: 'a@b.se', subject: 'Ansökan', textBody: 'Hej å' })
    expect(/^[A-Za-z0-9_-]+$/.test(raw)).toBe(true)
  })
})
