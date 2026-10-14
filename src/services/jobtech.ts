// JobTech JobSearch client — the only allowed source of job data.
// Data license: CC-BY-SA, attribute Arbetsförmedlingen. Never scrape.

import type { Job } from '../model/types'
import { MUNICIPALITIES } from '../jobs/municipalities'
import { mapJobTechAd } from '../jobs/mapJobTechAd'
import type { JobTechAd } from '../jobs/mapJobTechAd'

const BASE_URL = 'https://jobsearch.api.jobtechdev.se'
// Arkivet: samma öppna data, men BORTTAGNA annonser. Verifierat 2026-10-12 —
// historical-from/-to filtrerar på annonsens publiceringsperiod (en annons
// vars period spänner över dagen kommer med), och arkivet innehåller INGA
// annonser som fortfarande är ute (0 träffar för dagens datum). Därför måste
// "vilka jobb fanns ute den dagen" fråga BÅDA källorna och slå ihop svaren.
const HISTORICAL_URL = 'https://historical.api.jobtechdev.se'

export interface JobSearchParams {
  q?: string
  municipalityId?: string // JobTech municipality concept id
  worktimeExtentId?: string // JobTech worktime-extent concept id
  // AF's "Öppen för alla" mark: employers who focus on competence over
  // circumstances. A real server-side filter, verified against the live API
  // 2026-09-08 (981 → 49 hits). NOTE: the exact name open_for_all matters —
  // the API silently ignores unknown parameters (open-for-all changed
  // nothing), so this is asserted by test.
  openForAll?: boolean
  // Ett datum (YYYY-MM-DD) i stället för "just nu": vilka annonser var ute
  // den dagen. Sätts det hämtas både levande annonser publicerade senast den
  // dagen och arkiverade annonser vars period spände över den.
  onDate?: string
  limit?: number
  offset?: number
}

export interface JobSearchResult {
  total: number
  jobs: Job[]
}

// API:ts tak, verifierat 2026-10-14: limit max 100 (200 ⇒ 400), offset upp
// till 2000. Appen hämtade förut 25 — en sökning på lagerarbetare har 889
// annonser, så 864 av dem fanns helt enkelt inte i appen.
export const PAGE_SIZE = 100
export const MAX_OFFSET = 2000

// Dagen efter, som ISO-datum. Platsbankens published-before är exklusiv, så
// "publicerad senast den 31:a" kräver gränsen 1:a.
function dayAfter(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Exposed for testing: builds the request URL from the filter params.
// `archive` bygger mot arkivet i stället för de levande annonserna.
export function buildSearchUrl(params: JobSearchParams, archive = false): string {
  const url = new URL('/search', archive ? HISTORICAL_URL : BASE_URL)
  if (params.q) url.searchParams.set('q', params.q)
  if (params.municipalityId) {
    // Arkivet svarar 500 på concept-id och vill ha kommunkoden (verifierat
    // 2026-10-12: Malmö som concept-id ⇒ 500, som 1280 ⇒ 200). Saknas koden
    // utelämnas ortsfiltret hellre än att hela arkivfrågan dör.
    const code = archive
      ? MUNICIPALITIES.find((m) => m.id === params.municipalityId)?.code
      : params.municipalityId
    if (code) url.searchParams.set('municipality', code)
  }
  if (params.worktimeExtentId) url.searchParams.set('worktime-extent', params.worktimeExtentId)
  if (params.openForAll) url.searchParams.set('open_for_all', 'true')
  if (params.onDate) {
    if (archive) {
      // Annonsens period ska spänna över dagen — hela dygnet.
      url.searchParams.set('historical-from', `${params.onDate}T00:00:00`)
      url.searchParams.set('historical-to', `${params.onDate}T23:59:59`)
    } else {
      // Levande annons publicerad senast den dagen var ute den dagen.
      url.searchParams.set('published-before', `${dayAfter(params.onDate)}T00:00:00`)
    }
  }
  url.searchParams.set('limit', String(params.limit ?? PAGE_SIZE))
  if (params.offset) url.searchParams.set('offset', String(params.offset))
  return url.toString()
}

async function fetchPage(params: JobSearchParams, archive: boolean): Promise<JobSearchResult> {
  const response = await fetch(buildSearchUrl(params, archive), {
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

export async function searchJobs(params: JobSearchParams): Promise<JobSearchResult> {
  if (!params.onDate) return fetchPage(params, false)
  // Ett datum frågar båda källorna. Arkivets fel får aldrig dölja de levande
  // annonserna — och tvärtom: halva svaret är bättre än inget.
  const [live, archived] = await Promise.all([
    fetchPage(params, false).catch(() => ({ total: 0, jobs: [] }) as JobSearchResult),
    fetchPage(params, true).catch(() => ({ total: 0, jobs: [] }) as JobSearchResult),
  ])
  const seen = new Set(live.jobs.map((j) => j.id))
  const jobs = [...live.jobs, ...archived.jobs.filter((j) => !seen.has(j.id))]
  return { total: live.total + archived.total, jobs }
}
