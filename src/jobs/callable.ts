// "Går att ringa" — ads whose contact person left a phone number, so the
// participant can call the employer directly. Pure module — no ui/services/app.

import type { Job } from '../model/types'

// THE callability predicate — the card's ☎ tag, the "Går att ringa" filter
// and the panel's call block all use this one. It requires a dialable number
// (telHref !== ''), not just non-blank text: an ad whose "telephone" says
// "ring växeln" must neither be tagged ☎ nor pass the filter, because the
// panel would have no call button to offer.
export function isCallable(job: Job): boolean {
  return job.contact !== undefined && telHref(job.contact.telephone) !== ''
}

export function filterCallable(jobs: Job[]): Job[] {
  return jobs.filter(isCallable)
}

// A tel: href from a phone number written for humans. Keeps digits and a
// leading +, and drops the national "(0)" that follows a +46 country code —
// "tel:+46070…" dials a wrong number. Returns '' when no digits remain, so
// the UI can skip rendering a dead link.
export function telHref(raw: string): string {
  const cleaned = raw.replace(/\(0\)/g, '').trim()
  const plus = cleaned.startsWith('+')
  const digits = cleaned.replace(/\D/g, '')
  if (!digits) return ''
  return `tel:${plus ? '+' : ''}${digits}`
}
