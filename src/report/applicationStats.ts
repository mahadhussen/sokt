// Coach & provider overview statistics. Pure module — no ui/services/app.
//
// Aggregates the already-derived activity-report rows (which come only from
// Application records) into counts a coach and a Rusta och matcha provider can
// review with the participant. Numeric and rule based, therefore tested.

import type { EmploymentType } from '../model/types'
import type { ReportRow } from './activityReport'

export interface Count {
  key: string
  count: number
}

export interface ApplicationStats {
  total: number
  surveyAnswered: number
  byEmploymentType: Record<EmploymentType, number>
  byMunicipality: Count[] // sorted by count desc, then name asc
  byWeek: Count[] // ISO week label "YYYY-Vww", sorted ascending
}

// ISO-8601 week number for an ISO date string. Pure given a fixed input.
export function isoWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = (date.getUTCDay() + 6) % 7 // Monday = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // Thursday of this week decides the year
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4)) // Jan 4 is always in week 1
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3) // Thursday of week 1
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  return `${date.getUTCFullYear()}-V${String(week).padStart(2, '0')}`
}

export function applicationStats(rows: ReportRow[]): ApplicationStats {
  const byEmploymentType: Record<EmploymentType, number> = {
    heltid: 0,
    deltid: 0,
    timanstalld: 0,
  }
  const municipality = new Map<string, number>()
  const week = new Map<string, number>()
  let surveyAnswered = 0

  for (const row of rows) {
    byEmploymentType[row.employmentType]++
    if (row.surveyAnswered) surveyAnswered++
    if (row.municipality) municipality.set(row.municipality, (municipality.get(row.municipality) ?? 0) + 1)
    if (row.appliedAt) {
      const w = isoWeek(row.appliedAt)
      week.set(w, (week.get(w) ?? 0) + 1)
    }
  }

  const byMunicipality = [...municipality.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'sv'))

  const byWeek = [...week.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key))

  return { total: rows.length, surveyAnswered, byEmploymentType, byMunicipality, byWeek }
}
