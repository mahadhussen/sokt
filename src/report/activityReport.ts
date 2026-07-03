// The Arbetsförmedlingen activity report is a pure derivation of Application
// records. It never reads anything but Application records, and no field is
// invented here. Pure module: no imports from ui, render, services, or app.

import type { Application, EmploymentType } from '../model/types'

export interface ReportRow {
  jobTitle: string
  employerName: string
  employmentType: EmploymentType
  appliedAt: string // ISO date
  surveyAnswered: boolean
  municipality: string
  jobUrl?: string
}

// Both bounds are ISO dates (YYYY-MM-DD), inclusive. ISO dates compare
// correctly as strings, so no Date parsing is needed.
export function activityReport(
  applications: Application[],
  periodStart: string,
  periodEnd: string,
): ReportRow[] {
  return applications
    .filter(
      (a) => a.status === 'sent' && a.appliedAt >= periodStart && a.appliedAt <= periodEnd,
    )
    .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt))
    .map((a) => ({
      jobTitle: a.jobTitle,
      employerName: a.employerName,
      employmentType: a.employmentType,
      appliedAt: a.appliedAt,
      surveyAnswered: a.surveyAnswered,
      municipality: a.municipality,
      jobUrl: a.jobUrl,
    }))
}

const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  heltid: 'Heltid',
  deltid: 'Deltid',
  timanstalld: 'Timanställd',
}

export function employmentTypeLabel(t: EmploymentType): string {
  return EMPLOYMENT_LABEL[t]
}

export function surveyLabel(answered: boolean): string {
  return answered ? 'Ja' : 'Nej'
}

// Plain text export, one block per application, easy to enter in Mina sidor.
export function reportToText(rows: ReportRow[]): string {
  return rows
    .map((r) =>
      [
        `Jobbtitel: ${r.jobTitle}`,
        `Arbetsgivare: ${r.employerName}`,
        `Anställningsform: ${employmentTypeLabel(r.employmentType)}`,
        `Datum: ${r.appliedAt}`,
        `Besvarat urvalsfrågor: ${surveyLabel(r.surveyAnswered)}`,
        `Ort: ${r.municipality}`,
        ...(r.jobUrl ? [`Länk: ${r.jobUrl}`] : []),
      ].join('\n'),
    )
    .join('\n\n')
}

function csvEscape(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

// Semicolon separated (Swedish Excel convention), with a header row.
export function reportToCsv(rows: ReportRow[]): string {
  const header = 'Jobbtitel;Arbetsgivare;Anställningsform;Datum;Besvarat urvalsfrågor;Ort;Länk'
  const lines = rows.map((r) =>
    [
      r.jobTitle,
      r.employerName,
      employmentTypeLabel(r.employmentType),
      r.appliedAt,
      surveyLabel(r.surveyAnswered),
      r.municipality,
      r.jobUrl ?? '',
    ]
      .map(csvEscape)
      .join(';'),
  )
  return [header, ...lines].join('\n')
}
