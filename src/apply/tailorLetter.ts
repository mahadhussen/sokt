// Deterministic per-job letter tailoring. Pure module — no ui/services/app.
//
// This is NOT the AI letter tailoring from GOALS M2 (that needs the Anthropic
// API behind a backend, which the local build has no key for). It is a free,
// offline, deterministic fallback that still produces a per-job letter:
//
//  - If the base letter contains any {token}, the user has authored the
//    structure themselves — we only substitute tokens and respect their text.
//  - Otherwise we wrap the base letter with a greeting and a signature built
//    from the job facts and the profile.
//
// Report fields are never touched here — a letter is content, not an AF field.
// The seam: swap this call for an async backend call when a key exists.

import type { Job, Profile } from '../model/types'
import { canonicalOccupation } from '../jobs/taxonomy'

export interface LetterContext {
  job: Job
  profile: Profile
}

// Tokens the user may place in their base letter. Kept small and finite so the
// hint under the textarea can list them all (controls over guessing).
export function letterTokens(ctx: LetterContext): Record<string, string> {
  const { job, profile } = ctx
  return {
    tjanst: job.title,
    tjänst: job.title,
    yrke: canonicalOccupation(job.taxonomy, job.title),
    arbetsgivare: job.employer,
    ort: job.municipality,
    namn: `${profile.firstName} ${profile.lastName}`.trim(),
  }
}

// Token names may contain non-ASCII letters (tjänst), so match anything
// between braces rather than \w. Unknown tokens are left untouched.
export function hasTokens(text: string): boolean {
  return /\{[^{}]+\}/.test(text)
}

function substitute(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{([^{}]+)\}/g, (whole, key: string) =>
    key in tokens ? tokens[key] : whole,
  )
}

export function tailorLetter(ctx: LetterContext): string {
  const { job, profile } = ctx
  const tokens = letterTokens(ctx)
  const base = profile.baseLetter.trim()

  if (hasTokens(base)) {
    return substitute(base, tokens)
  }

  const fullName = tokens.namn
  const greeting = job.employer ? `Hej ${job.employer},` : 'Hej,'
  const opener = `Jag är intresserad av tjänsten som ${job.title}${
    job.municipality ? ` i ${job.municipality}` : ''
  } och vill härmed skicka min ansökan.`
  const signatureLines = [
    'Med vänliga hälsningar,',
    fullName,
    profile.details.telefon ?? '',
    profile.email,
  ].filter(Boolean)

  return [greeting, '', opener, ...(base ? ['', base] : []), '', signatureLines.join('\n')].join('\n')
}
