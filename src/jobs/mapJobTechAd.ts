// Maps a raw JobTech JobSearch ad to the Job type.
// Pure module: no imports from ui, render, services, or app.

import type { Job } from '../model/types'
import { mapTaxonomy } from './taxonomy'
import type { TaxonomyAd } from './taxonomy'

interface RawConcept {
  concept_id?: string | null
  label?: string | null
}

// The subset of the JobTech JobSearch hit we read. Everything optional —
// the mapper must never crash on a sparse ad.
export interface JobTechAd extends TaxonomyAd {
  id?: string | number
  headline?: string | null
  employer?: { name?: string | null } | null
  workplace_address?: { municipality?: string | null } | null
  working_hours_type?: { label?: string | null } | null
  employment_type?: { label?: string | null } | null
  application_details?: {
    url?: string | null
    email?: string | null
  } | null
  occupation?: RawConcept | null
  occupation_group?: RawConcept | null
  occupation_field?: RawConcept | null
  webpage_url?: string | null
  publication_date?: string | null
}

// AF anställningsform: heltid, deltid eller timanställd.
// Behovs-/timanställning tar företräde framför arbetstidsomfattningen,
// därefter avgör working_hours_type (Heltid/Deltid).
export function mapEmploymentType(ad: JobTechAd): Job['employmentType'] {
  const employmentLabel = (ad.employment_type?.label ?? '').toLowerCase()
  if (employmentLabel.includes('behov') || employmentLabel.includes('timanställning')) {
    return 'timanstalld'
  }
  const hoursLabel = (ad.working_hours_type?.label ?? '').toLowerCase()
  if (hoursLabel === 'heltid') return 'heltid'
  if (hoursLabel === 'deltid') return 'deltid'
  return 'unknown'
}

export function mapApplicationChannel(ad: JobTechAd): Job['applicationChannel'] {
  const url = ad.application_details?.url
  if (url) return { kind: 'url', value: url }
  const email = ad.application_details?.email
  if (email) return { kind: 'email', value: email }
  return { kind: 'unknown' }
}

export function mapJobTechAd(ad: JobTechAd): Job {
  return {
    id: String(ad.id ?? ''),
    title: ad.headline ?? '',
    employer: ad.employer?.name ?? '',
    municipality: ad.workplace_address?.municipality ?? '',
    employmentType: mapEmploymentType(ad),
    applicationChannel: mapApplicationChannel(ad),
    taxonomy: mapTaxonomy(ad),
    source: 'platsbanken',
    publishedAt: ad.publication_date ?? '',
    url: ad.webpage_url ?? '',
  }
}
