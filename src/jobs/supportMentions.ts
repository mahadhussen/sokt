// Deterministic text matching for employment-support forms MENTIONED in an
// ad's free text. Pure module — no ui/services/app.
//
// Sanningskälla: the JobSearch API has no structured field for support forms
// (measured 2026-09-08 against real responses — "nystartsjobb" etc. appear
// only in description/headline text). So a hit here means exactly one thing:
// the employer WROTE the word in the ad. The UI must always say "annonsen
// nämner …", never present it as a verified attribute of the job.
//
// Ordlistan — varje matchare är vald mot verkliga annonser:
//   - 'nystartsjobb'        exact program word. NOT bare "nystart": it matches
//                           "nystartat företag" (a new company, not the stöd).
//   - 'utvecklingsgaranti'  covers "jobb- och utvecklingsgarantin" and the
//                           bare "utvecklingsgarantin".
//   - 'introduktionsjobb'   exact program word.
//   - 'lönebidrag'          also matches "lönebidragsanställning".
//   - grouped under 'stod': 'anställningsstöd', 'etableringsjobb',
//                           'subventionerad anställning', 'trygghetsanställning'
//                           — real but rare; one badge instead of four.
// EXCLUDED after measuring real ads (2026-09-08):
//   - 'extratjänst': in ad language it means "extra job / on-call gig"
//     ("Omfattning: extratjänst på timmar"), not the phased-out AF program.
//     Matching it would fabricate a support claim. False friend.
//   - 'praktik', 'arbetsträning': not anställningsformer, and far too noisy.

import type { Job, SupportFormId } from '../model/types'

export interface SupportForm {
  id: SupportFormId
  // Lowercase substrings; a text containing any of them mentions the form.
  matchers: string[]
}

export const SUPPORT_FORMS: SupportForm[] = [
  { id: 'nystartsjobb', matchers: ['nystartsjobb'] },
  { id: 'utvecklingsgarantin', matchers: ['utvecklingsgaranti'] },
  { id: 'introduktionsjobb', matchers: ['introduktionsjobb'] },
  { id: 'lonebidrag', matchers: ['lönebidrag'] },
  {
    id: 'stod',
    matchers: [
      'anställningsstöd',
      'etableringsjobb',
      'subventionerad anställning',
      'trygghetsanställning',
    ],
  },
]

// Which support forms the given ad text mentions. Case-insensitive substring
// match, each form reported once, in SUPPORT_FORMS order (deterministic).
export function findSupportMentions(text: string): SupportFormId[] {
  const low = text.toLowerCase()
  return SUPPORT_FORMS.filter((form) => form.matchers.some((m) => low.includes(m))).map(
    (form) => form.id,
  )
}

export function mentionsSupport(job: Job): boolean {
  return (job.supportMentions?.length ?? 0) > 0
}

export function filterSupportMentions(jobs: Job[]): Job[] {
  return jobs.filter(mentionsSupport)
}
