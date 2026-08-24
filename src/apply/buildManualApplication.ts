// Builds an Application the participant typed in themselves, for a job they
// applied to outside Sökt. Pure module: no imports from ui, render, services,
// or app.
//
// WHY THIS EXISTS: until now the only way into the log was the Ansök panel on
// a search result, so an application made by walking into a shop, phoning an
// employer, answering a tip from a coach, or replying to an ad found elsewhere
// could not be recorded at all. The aktivitetsrapport is a legal document that
// must cover everything the jobseeker did — a report that silently omits half
// of it is worse than no report. Arbetsförmedlingen spot-checks these.
//
// Same discipline as buildApplication: every AF field comes from what the user
// explicitly typed, this module never invents or guesses a value, and an
// incomplete record is refused rather than filled in with a plausible default.

import type { Application, EmploymentType, Id } from '../model/types'

export interface ManualApplyInput {
  id: Id // supplied by the caller so this module stays pure
  jobTitle: string
  employerName: string
  employmentType: EmploymentType | ''
  appliedAt: string // ISO date (YYYY-MM-DD)
  surveyAnswered: boolean
  municipality: string
  jobUrl?: string
}

// The fields that can be wrong, as keys the UI translates. Returning keys
// rather than sentences keeps this module pure AND keeps the error readable in
// Arabic and Somali — a thrown Swedish string would not be.
export type ManualField = 'jobTitle' | 'employerName' | 'employmentType' | 'appliedAt' | 'municipality'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Empty list means the input is complete. Order matches the form.
export function validateManualApply(input: ManualApplyInput): ManualField[] {
  const missing: ManualField[] = []
  if (!input.jobTitle.trim()) missing.push('jobTitle')
  if (!input.employerName.trim()) missing.push('employerName')
  if (!input.employmentType) missing.push('employmentType')
  if (!ISO_DATE.test(input.appliedAt) || Number.isNaN(Date.parse(input.appliedAt))) {
    missing.push('appliedAt')
  }
  if (!input.municipality.trim()) missing.push('municipality')
  return missing
}

export function buildManualApplication(input: ManualApplyInput): Application {
  const missing = validateManualApply(input)
  if (missing.length > 0) {
    throw new Error(`Ofullständig ansökan: ${missing.join(', ')}`)
  }
  const jobUrl = input.jobUrl?.trim()
  return {
    id: input.id,
    jobTitle: input.jobTitle.trim(),
    employerName: input.employerName.trim(),
    // Checked by validateManualApply; the cast is safe because '' is rejected.
    employmentType: input.employmentType as EmploymentType,
    appliedAt: input.appliedAt,
    surveyAnswered: input.surveyAnswered,
    municipality: input.municipality.trim(),
    // Traceability, not a report field: this record did not come from an ad.
    channel: 'manual',
    jobUrl: jobUrl || undefined,
    status: 'sent',
  }
}
