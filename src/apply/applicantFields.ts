// Copy-ready applicant fields for the apply flow. Pure module — no ui/app.
//
// BUILD_SPEC: the tool "prepares, prefills, and streamlines" the sanctioned
// application. It never auto-submits into a third-party system, but it can
// hand the applicant their own saved details as one-click-copy values so a
// form (or an email) is filled in seconds instead of retyped every time.

import type { Profile } from '../model/types'

export interface ApplicantField {
  key: string
  value: string
}

// The saved details worth copying into an application, in a sensible order.
// Empty values are dropped so the panel only shows what the user actually has.
export function applicantFields(profile: Profile): ApplicantField[] {
  const d = profile.details
  const candidates: ApplicantField[] = [
    { key: 'firstName', value: profile.firstName },
    { key: 'lastName', value: profile.lastName },
    { key: 'email', value: profile.email },
    { key: 'phone', value: d.telefon ?? '' },
    { key: 'address', value: d.adress ?? '' },
    { key: 'city', value: d.ort ?? '' },
    { key: 'birthYear', value: d.fodelsear ?? '' },
  ]
  return candidates.filter((f) => f.value.trim() !== '')
}
