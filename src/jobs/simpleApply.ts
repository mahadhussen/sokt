// "Enkel ansökan" rule. Pure module — no ui/services/app.
//
// The user wants only jobs where applying needs at most name, surname, CV and
// a letter — never a heavy third-party form (e.g. an external ATS asking for
// birth year, address, gender…). We cannot inspect a foreign application form
// without scraping (forbidden), so we use the ad's own sanctioned channel:
//
//   - email channel  → you apply by email, attaching the CV and the letter.
//     Nothing more than what the user already controls. This IS simple apply.
//   - url channel    → routes to an external system whose form we cannot see
//     or predict. Excluded, because we cannot guarantee it stays within
//     name + CV + letter.
//   - unknown        → no machine-readable channel; excluded for the same reason.

import type { Job } from '../model/types'

export function isSimpleApply(job: Job): boolean {
  return job.applicationChannel.kind === 'email'
}

export function filterSimpleApply(jobs: Job[]): Job[] {
  return jobs.filter(isSimpleApply)
}
