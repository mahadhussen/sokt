// Freshness of the cached job feed. Pure module — no ui/services/app.
//
// The local, backend-free interpretation of GOALS M2 "JobStream local mirror
// for freshness": the last successful search (its results + a timestamp) is
// cached so the feed is there instantly on reopen — offline included — with an
// honest "last fetched" stamp. A true JobStream mirror (a server consuming the
// change stream into a database) needs a backend; see WORKLOG.

import type { Job } from '../model/types'

export interface CachedSearch {
  q: string
  municipalityId: string
  worktimeExtentId: string
  simpleOnly: boolean
  jobs: Job[]
  total: number
  fetchedAt: number // ms since epoch
}

// Whole minutes between two epoch timestamps, never negative.
export function minutesAgo(fetchedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - fetchedAt) / 60_000))
}
