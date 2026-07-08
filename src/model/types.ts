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

export interface Job {
  // from JobTech, mapped
  id: Id
  title: string
  employer: string
  municipality: string // ort
  employmentType: EmploymentType | 'unknown'
  applicationChannel: { kind: 'url' | 'email' | 'unknown'; value?: string }
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
