// JobTech JobSearch client — the only allowed source of job data.
// Data license: CC-BY-SA, attribute Arbetsförmedlingen. Never scrape.

import type { Job } from '../model/types'
import { mapJobTechAd } from '../jobs/mapJobTechAd'
import type { JobTechAd } from '../jobs/mapJobTechAd'

const BASE_URL = 'https://jobsearch.api.jobtechdev.se'

export interface JobSearchParams {
  q?: string
  municipality?: string // free text ort, matched via the q parameter
  limit?: number
  offset?: number
}

export interface JobSearchResult {
  total: number
  jobs: Job[]
}

export async function searchJobs(params: JobSearchParams): Promise<JobSearchResult> {
  const query = [params.q, params.municipality].filter(Boolean).join(' ')
  const url = new URL('/search', BASE_URL)
  if (query) url.searchParams.set('q', query)
  url.searchParams.set('limit', String(params.limit ?? 25))
  if (params.offset) url.searchParams.set('offset', String(params.offset))

  const response = await fetch(url, { headers: { accept: 'application/json' } })
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
