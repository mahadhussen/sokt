// Has this job already been applied to? Pure module: no imports from ui,
// render, services, or app.
//
// WHY THIS EXISTS: nothing anywhere checked. Next week the same ads come back
// looking untouched, so the participant either applies twice — which wastes the
// one thing they have least of, and reads badly to the employer — or logs the
// same application twice. A duplicate row is exactly what gets an
// aktivitetsrapport questioned, and the same ad genuinely appears twice in
// Sökt: once from Platsbanken and once via JobAd Links.

import type { Application, Job } from '../model/types'
import { fold } from '../jobs/occupations'

// What identifies "the same job" when there is no shared id to trust. Ads are
// re-published with new ids, and the two sources number them differently, so
// employer + title is the honest key. Folded, because "Städare" and "stadare"
// are the same job to a human.
function identity(employer: string, title: string): string {
  return `${fold(employer)}::${fold(title)}`
}

function daysBetween(isoA: string, isoB: string): number {
  const a = Date.parse(isoA)
  const b = Date.parse(isoB)
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY
  return Math.abs(a - b) / 86_400_000
}

// The logged application for this ad, if the participant already applied to it.
// Used to mark a job card, so the feed shows what has been done.
export function appliedTo(applications: Application[], job: Job): Application | null {
  const url = job.url.trim()
  const byUrl = url ? applications.find((a) => a.jobUrl === url) : undefined
  if (byUrl) return byUrl
  const key = identity(job.employer, job.title)
  return applications.find((a) => identity(a.employerName, a.jobTitle) === key) ?? null
}

export interface DuplicateCandidate {
  jobTitle: string
  employerName: string
  appliedAt: string
  jobUrl?: string
}

// An existing application that the candidate would duplicate, or null.
//
// The URL match is exact and timeless: the same ad is the same ad whenever it
// was applied to. The employer+title match is bounded by `withinDays`, because
// applying to the same employer for the same role six months apart is a real
// second application, not a mistake.
export function findDuplicate(
  applications: Application[],
  candidate: DuplicateCandidate,
  withinDays = 60,
): Application | null {
  const url = candidate.jobUrl?.trim()
  const byUrl = url ? applications.find((a) => a.jobUrl === url) : undefined
  if (byUrl) return byUrl

  const key = identity(candidate.employerName, candidate.jobTitle)
  return (
    applications.find(
      (a) =>
        identity(a.employerName, a.jobTitle) === key &&
        daysBetween(a.appliedAt, candidate.appliedAt) <= withinDays,
    ) ?? null
  )
}
