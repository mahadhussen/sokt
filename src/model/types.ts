// The model contract, exactly as locked in ARCHITECTURE.md.
// Pure module: never import ui, render, services, or app.

export type Id = string

export type EmploymentType = 'heltid' | 'deltid' | 'timanstalld'

// A reference into the JobTech taxonomy: a stable concept id plus its label.
export interface TaxonomyRef {
  id: string
  label: string
}

// Occupation taxonomy carried by the ad, most specific first.
export interface JobTaxonomy {
  occupation?: TaxonomyRef // e.g. Städare/Lokalvårdare
  group?: TaxonomyRef // e.g. Städare
  field?: TaxonomyRef // e.g. Sanering och renhållning
}

// A contact person from the ad who left a phone number — the "ring
// arbetsgivaren" path. Mapped straight from the ad's application_contacts;
// never invented.
export interface JobContact {
  name: string // may be empty — some ads leave only a number
  title: string // the contact's role in the ad, e.g. "Butikschef"; may be empty
  telephone: string // exactly as written in the ad
}

// Employment-support forms an ad can MENTION in its free text. These are
// derived by deterministic text matching (jobs/supportMentions) and must
// always be presented as "the ad mentions …", never as a verified attribute —
// the JobSearch API has no structured field for them (measured 2026-09-08).
export type SupportFormId =
  | 'nystartsjobb'
  | 'utvecklingsgarantin'
  | 'introduktionsjobb'
  | 'lonebidrag'
  | 'stod' // other named support forms, grouped (anställningsstöd m.fl.)

export interface Job {
  // from JobTech, mapped
  id: Id
  title: string
  employer: string
  municipality: string // ort
  employmentType: EmploymentType | 'unknown'
  applicationChannel: { kind: 'url' | 'email' | 'unknown'; value?: string }
  // Optional (absent when the ad carries none) so cached jobs from before
  // these fields existed stay valid — readers must treat absence as "none".
  contact?: JobContact
  supportMentions?: SupportFormId[]
  taxonomy: JobTaxonomy // M2: occupation mapped to the JobTech taxonomy
  // platsbanken = JobTech JobSearch; joblinks = JobTech JobAd Links (external
  // boards, link-only ads). Both are official Arbetsförmedlingen open data.
  source: 'platsbanken' | 'joblinks'
  publishedAt: string
  url: string
}

export interface Profile {
  id: Id
  firstName: string
  lastName: string
  email: string
  cvFileRef?: string
  baseLetter: string
  details: Record<string, string>
}

export interface Application {
  // single source of truth for the activity report
  id: Id
  jobTitle: string // AF field
  employerName: string // AF field
  employmentType: EmploymentType // AF field
  appliedAt: string // AF field, ISO date (YYYY-MM-DD)
  surveyAnswered: boolean // AF field, ja or nej
  municipality: string // AF field, ort
  channel: string
  jobUrl?: string
  status: 'sent' | 'draft'
}
