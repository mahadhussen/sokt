// Builds the Application record from a Job at apply time. Deterministic:
// every AF field comes from the job or from what the user explicitly chose —
// never from a language model. Pure module: no imports from ui, render,
// services, or app.

import type { Application, EmploymentType, Id, Job } from '../model/types'

export interface ApplyInput {
  id: Id // supplied by the caller so this module stays pure
  appliedAt: string // ISO date (YYYY-MM-DD)
  surveyAnswered: boolean
  // Required when the ad's mapping is 'unknown'; otherwise optional override.
  employmentType?: EmploymentType
  // Required when the ad has no municipality; otherwise optional override.
  municipality?: string
}

export function channelString(channel: Job['applicationChannel']): string {
  if (channel.kind === 'url' && channel.value) return `url:${channel.value}`
  if (channel.kind === 'email' && channel.value) return `email:${channel.value}`
  return 'unknown'
}

export function buildApplication(job: Job, input: ApplyInput): Application {
  const employmentType =
    input.employmentType ?? (job.employmentType === 'unknown' ? null : job.employmentType)
  if (!employmentType) {
    throw new Error('Anställningsform saknas: annonsen anger ingen, välj heltid/deltid/timanställd')
  }
  const municipality = input.municipality ?? job.municipality
  if (!municipality) {
    throw new Error('Ort saknas: annonsen anger ingen ort, ange den vid ansökan')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.appliedAt)) {
    throw new Error(`Ogiltigt datum: ${input.appliedAt} (förväntade YYYY-MM-DD)`)
  }
  return {
    id: input.id,
    jobTitle: job.title,
    employerName: job.employer,
    employmentType,
    appliedAt: input.appliedAt,
    surveyAnswered: input.surveyAnswered,
    municipality,
    channel: channelString(job.applicationChannel),
    jobUrl: job.url || undefined,
    status: 'sent',
  }
}
