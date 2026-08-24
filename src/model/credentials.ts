// Email and one-time code handling. Pure module: no imports from ui, render,
// services, or app.
//
// This is the front door of the product, used by people typing an address on a
// phone keyboard in a language they may not read well. Every rule here exists
// to accept what a person actually types rather than to enforce a spec: a
// pasted code with spaces, a trailing space from autocomplete, a capitalised
// address. Rejecting those is not strictness, it is a locked door.

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

// Deliberately permissive. A stricter pattern rejects valid addresses
// (apostrophes, plus tags, new TLDs) and the only real check is whether the
// code arrives.
export function isValidEmail(input: string): boolean {
  const email = normalizeEmail(input)
  if (email.length < 5 || email.length > 254) return false
  if (/\s/.test(email)) return false
  const at = email.indexOf('@')
  if (at < 1 || at !== email.lastIndexOf('@')) return false
  const domain = email.slice(at + 1)
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.')
}

// The code length is a SERVER setting, not ours to assume. Supabase's email OTP
// length is configurable from 6 to 10 digits, and a real project was seen
// issuing 8. Hard-coding 6 truncated those codes to a wrong 6 and every login
// failed silently. So we accept the whole supported range and let the server be
// the judge of the exact value — the app never decides how long a code "should"
// be.
export const MIN_CODE_LENGTH = 6
export const MAX_CODE_LENGTH = 10

// Codes get pasted from a mail app with spaces, non-breaking spaces, or dashes
// in them, and read aloud digit by digit. Keep the digits, drop the rest.
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH)
}

// Enough digits to be worth trying. The server rejects a wrong code with a clear
// message, so "long enough" beats "exactly N" — the latter is what broke login
// when N was wrong.
export function isCompleteCode(input: string): boolean {
  return normalizeCode(input).length >= MIN_CODE_LENGTH
}
