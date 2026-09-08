// The display filters applied to an already-fetched result. Pure module —
// one function so the search path, the restore path and every toggle derive
// the visible list the exact same way (a single source for "what is shown").
//
// These filter the CLIENT side of a result page. openForAll is deliberately
// not here: it is a server-side query parameter (services/jobtech), and
// re-filtering locally would pretend we can see a flag the hits do not carry.

import type { Job } from '../model/types'
import { filterSimpleApply } from './simpleApply'
import { filterCallable } from './callable'
import { filterSupportMentions } from './supportMentions'

export interface JobViewFilter {
  simpleOnly: boolean
  callableOnly: boolean
  supportOnly: boolean
}

export const NO_VIEW_FILTER: JobViewFilter = {
  simpleOnly: false,
  callableOnly: false,
  supportOnly: false,
}

export function applyJobFilters(jobs: Job[], filter: JobViewFilter): Job[] {
  let out = jobs
  if (filter.simpleOnly) out = filterSimpleApply(out)
  if (filter.callableOnly) out = filterCallable(out)
  if (filter.supportOnly) out = filterSupportMentions(out)
  return out
}
