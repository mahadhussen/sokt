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

export const CODE_LENGTH = 6

// Codes get pasted from a mail app with spaces, non-breaking spaces, or dashes
// in them, and read aloud digit by digit. Keep the digits, drop the rest.
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, CODE_LENGTH)
}

export function isCompleteCode(input: string): boolean {
  return normalizeCode(input).length === CODE_LENGTH
}
