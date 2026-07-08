// JobTech JobAd Links client — the second sanctioned job source (link ads
// from other Swedish boards, official Arbetsförmedlingen open data).
// AF duplicates are dropped by the mapper; only truly external ads surface.

import type { Job } from '../model/types'
import { mapJobLinksAds } from '../jobs/mapJobLinksAd'
import type { JobLinksAd } from '../jobs/mapJobLinksAd'

const BASE_URL = 'https://links.api.jobtechdev.se'

export interface JobLinksParams {
  q?: string
  municipalityId?: string
  limit?: number
}

// Exposed for testing: builds the request URL from the filter params.
export function buildJobLinksUrl(params: JobLinksParams): string {
  const url = new URL('/joblinks', BASE_URL)
  if (params.q) url.searchParams.set('q', params.q)
  if (params.municipalityId) url.searchParams.set('municipality', params.municipalityId)
  url.searchParams.set('limit', String(params.limit ?? 100))
  return url.toString()
}

export async function searchJobLinks(params: JobLinksParams): Promise<Job[]> {
  const response = await fetch(buildJobLinksUrl(params), {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`JobAd Links-sökningen misslyckades: ${response.status}`)
  }
  const body = (await response.json()) as { hits?: JobLinksAd[] }
  return mapJobLinksAds(body.hits ?? [])
}
