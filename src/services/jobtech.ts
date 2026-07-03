// JobTech JobSearch client — the only allowed source of job data.
// Data license: CC-BY-SA, attribute Arbetsförmedlingen. Never scrape.

import type { Job } from '../model/types'
import { mapJobTechAd } from '../jobs/mapJobTechAd'
import type { JobTechAd } from '../jobs/mapJobTechAd'

const BASE_URL = 'https://jobsearch.api.jobtechdev.se'

export interface JobSearchParams {
  q?: string
  municipalityId?: string // JobTech municipality concept id
  worktimeExtentId?: string // JobTech worktime-extent concept id
  limit?: number
  offset?: number
}

export interface JobSearchResult {
  total: number
  jobs: Job[]
}

// Exposed for testing: builds the request URL from the filter params.
export function buildSearchUrl(params: JobSearchParams): string {
  const url = new URL('/search', BASE_URL)
  if (params.q) url.searchParams.set('q', params.q)
  if (params.municipalityId) url.searchParams.set('municipality', params.municipalityId)
  if (params.worktimeExtentId) url.searchParams.set('worktime-extent', params.worktimeExtentId)
  url.searchParams.set('limit', String(params.limit ?? 25))
  if (params.offset) url.searchParams.set('offset', String(params.offset))
  return url.toString()
}

export async function searchJobs(params: JobSearchParams): Promise<JobSearchResult> {
  const response = await fetch(buildSearchUrl(params), {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`JobTech-sökningen misslyckades: ${response.status}`)
  }
  const body = (await response.json()) as {
    total?: { value?: number }
    hits?: JobTechAd[]
  }
  return {
    total: body.total?.value ?? 0,
    jobs: (body.hits ?? []).map(mapJobTechAd),
  }
}
