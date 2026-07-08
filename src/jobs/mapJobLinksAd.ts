// Maps JobTech JobAd Links hits to Job. Pure module — no ui/services/app.
//
// JobAd Links aggregates ads from other Swedish job boards as LINKS (official
// Arbetsförmedlingen open data — not scraping). Most hits also exist in
// Platsbanken; those are duplicates of our main feed, so the mapper keeps only
// ads WITHOUT an arbetsformedlingen.se source link (measured 2026-07-07:
// 0–7% unique for AF-adjacent occupations, 10–17% for e.g. säljare/utvecklare).
//
// Link-only ads carry no employment type and no application email — the only
// channel is the external board's page, so they are never "enkel ansökan".

import type { Job } from '../model/types'
import { mapTaxonomy } from './taxonomy'

interface RawConcept {
  concept_id?: string | null
  label?: string | null
}

export interface JobLinksAd {
  id?: string | null
  headline?: string | null
  employer?: { name?: string | null } | null
  occupation_group?: RawConcept | null
  occupation_field?: RawConcept | null
  workplace_addresses?: { municipality?: string | null }[] | null
  publication_date?: string | null
  source_links?: { label?: string | null; url?: string | null }[] | null
}

function isAfLink(label: string | null | undefined): boolean {
  return (label ?? '').includes('arbetsformedlingen')
}

// The external board link the ad points to, or null when the ad is an AF
// duplicate (or carries no usable link at all).
export function externalLink(ad: JobLinksAd): { label: string; url: string } | null {
  const links = ad.source_links ?? []
  if (links.some((l) => isAfLink(l.label))) return null
  const first = links.find((l) => l.url)
  return first?.url ? { label: first.label ?? '', url: first.url } : null
}

export function mapJobLinksAd(ad: JobLinksAd): Job | null {
  const link = externalLink(ad)
  if (!link) return null
  return {
    id: `joblinks:${ad.id ?? ''}`,
    title: (ad.headline ?? '').trim(),
    employer: ad.employer?.name ?? '',
    municipality: ad.workplace_addresses?.[0]?.municipality ?? '',
    employmentType: 'unknown',
    applicationChannel: { kind: 'url', value: link.url },
    taxonomy: mapTaxonomy(ad),
    source: 'joblinks',
    publishedAt: ad.publication_date ?? '',
    url: link.url,
  }
}

// Maps a page of hits, dropping AF duplicates and linkless ads.
export function mapJobLinksAds(ads: JobLinksAd[]): Job[] {
  return ads.map(mapJobLinksAd).filter((j): j is Job => j !== null)
}

// The board's hostname for honest source labeling in the UI.
export function sourceHost(job: Job): string {
  try {
    return new URL(job.url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
