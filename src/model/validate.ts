// Runtime guards for the stored model. Pure module: no imports from ui, render,
// services, or app.
//
// Stored JSON is data from outside the program's control — a half-written
// value, a hand-edited file, a restore from another device. Without these
// guards a single bad row reaches the render tree and, with no error boundary,
// takes the whole app down: the participant then cannot even reach Export or
// Delete, because those live inside the app that just died.

import type { Application, EmploymentType, Profile } from './types'

const EMPLOYMENT_TYPES: EmploymentType[] = ['heltid', 'deltid', 'timanstalld']

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function isApplication(value: unknown): value is Application {
  if (typeof value !== 'object' || value === null) return false
  const a = value as Partial<Application>
  return (
    isNonEmptyString(a.id) &&
    typeof a.jobTitle === 'string' &&
    typeof a.employerName === 'string' &&
    EMPLOYMENT_TYPES.includes(a.employmentType as EmploymentType) &&
    typeof a.appliedAt === 'string' &&
    typeof a.surveyAnswered === 'boolean' &&
    typeof a.municipality === 'string' &&
    typeof a.channel === 'string' &&
    (a.jobUrl === undefined || typeof a.jobUrl === 'string') &&
    (a.status === 'sent' || a.status === 'draft')
  )
}

export function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Partial<Profile>
  return (
    isNonEmptyString(p.id) &&
    typeof p.firstName === 'string' &&
    typeof p.lastName === 'string' &&
    typeof p.email === 'string' &&
    typeof p.baseLetter === 'string' &&
    typeof p.details === 'object' &&
    p.details !== null
  )
}
