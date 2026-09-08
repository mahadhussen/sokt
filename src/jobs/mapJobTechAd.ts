// Maps a raw JobTech JobSearch ad to the Job type.
// Pure module: no imports from ui, render, services, or app.

import type { Job } from '../model/types'
import { mapTaxonomy } from './taxonomy'
import type { TaxonomyAd } from './taxonomy'
import { findSupportMentions } from './supportMentions'

interface RawConcept {
  concept_id?: string | null
  label?: string | null
}

// One entry of the ad's application_contacts. Measured against 26 real
// contacts (2026-09-08): the role lives in `contact_type` ("Enhetschef",
// "Teamledare", "HR"); `description` was null in every sample but is kept as
// fallback since the schema allows it.
interface RawContact {
  name?: string | null
  description?: string | null
  telephone?: string | null
  email?: string | null
  contact_type?: string | null
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
  application_contacts?: (RawContact | null)[] | null
  description?: { text?: string | null } | null
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

// E-post före formulärlänk. En annons kan bära båda, och då är e-posten den
// väg vår målgrupp faktiskt klarar: namn, CV och brev i ett mail, i stället för
// ett svenskt rekryteringsformulär med konto och tjugo fält. Att läsa url först
// stängde ute de annonser som erbjöd båda från "enkel ansökan".
export function mapApplicationChannel(ad: JobTechAd): Job['applicationChannel'] {
  const email = ad.application_details?.email
  if (email) return { kind: 'email', value: email }
  const url = ad.application_details?.url
  if (url) return { kind: 'url', value: url }
  return { kind: 'unknown' }
}

// Public-sector ads list union representatives ("Kommunal sektion …",
// "Fackliga företrädare …") next to the hiring manager. Calling the union to
// ask for a job is the wrong call, so those are deprioritized — never
// excluded outright: if the union rep is the only number, it is still shown.
function looksLikeUnionContact(c: RawContact): boolean {
  const s = `${c.name ?? ''} ${c.contact_type ?? ''}`.toLowerCase()
  return s.includes('facklig') || /(^|[^a-zåäö])kommunal([^a-zåäö]|$)/.test(s)
}

// The contact to call — the "ring arbetsgivaren" path. Measured 2026-09-08:
// 51 of 365 real ads across four searches carried a telephone. Preference,
// deterministic: (1) phone + role + not union, (2) phone + not union,
// (3) any phone. Hiring managers carry a contact_type in the data; union
// reps almost never do.
export function mapContact(ad: JobTechAd): Job['contact'] {
  const withPhone = (ad.application_contacts ?? [])
    .filter((c): c is RawContact => c !== null && c !== undefined)
    .filter((c) => (c.telephone ?? '').trim() !== '')
  const chosen =
    withPhone.find((c) => (c.contact_type ?? '').trim() !== '' && !looksLikeUnionContact(c)) ??
    withPhone.find((c) => !looksLikeUnionContact(c)) ??
    withPhone[0]
  if (!chosen) return undefined
  return {
    name: (chosen.name ?? '').trim(),
    title: ((chosen.contact_type ?? '') || (chosen.description ?? '')).trim(),
    telephone: (chosen.telephone ?? '').trim(),
  }
}

export function mapJobTechAd(ad: JobTechAd): Job {
  // Headline included: some ads put "Nystartsjobb" in the title alone.
  const supportMentions = findSupportMentions(`${ad.headline ?? ''}\n${ad.description?.text ?? ''}`)
  const contact = mapContact(ad)
  return {
    // Both are optional on Job and omitted (not set to undefined) when absent,
    // so cached search payloads in localStorage stay free of noise.
    ...(contact ? { contact } : {}),
    ...(supportMentions.length > 0 ? { supportMentions } : {}),
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
