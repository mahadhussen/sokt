import { describe, expect, it } from 'vitest'
import type { ReportRow } from './activityReport'
import { applicationStats, isoWeek } from './applicationStats'

function row(overrides: Partial<ReportRow>): ReportRow {
  return {
    jobTitle: 'Lokalvårdare',
    employerName: 'Städ AB',
    employmentType: 'heltid',
    appliedAt: '2026-07-06',
    surveyAnswered: false,
    municipality: 'Uppsala',
    ...overrides,
  }
}

describe('isoWeek', () => {
  it('computes the ISO week label', () => {
    expect(isoWeek('2026-07-06')).toBe('2026-V28') // Monday of week 28
    expect(isoWeek('2026-01-01')).toBe('2026-V01')
    expect(isoWeek('2025-12-29')).toBe('2026-V01') // belongs to next ISO year
  })
})

describe('applicationStats', () => {
  it('counts total, survey, employment type, municipality and week', () => {
    const rows = [
      row({ employmentType: 'heltid', municipality: 'Uppsala', surveyAnswered: true, appliedAt: '2026-07-06' }),
      row({ employmentType: 'deltid', municipality: 'Uppsala', surveyAnswered: false, appliedAt: '2026-07-07' }),
      row({ employmentType: 'timanstalld', municipality: 'Stockholm', surveyAnswered: true, appliedAt: '2026-07-13' }),
    ]
    const s = applicationStats(rows)
    expect(s.total).toBe(3)
    expect(s.surveyAnswered).toBe(2)
    expect(s.byEmploymentType).toEqual({ heltid: 1, deltid: 1, timanstalld: 1 })
    expect(s.byMunicipality).toEqual([
      { key: 'Uppsala', count: 2 },
      { key: 'Stockholm', count: 1 },
    ])
    expect(s.byWeek).toEqual([
      { key: '2026-V28', count: 2 },
      { key: '2026-V29', count: 1 },
    ])
  })

  it('is all zeros for no rows', () => {
    const s = applicationStats([])
    expect(s.total).toBe(0)
    expect(s.byEmploymentType).toEqual({ heltid: 0, deltid: 0, timanstalld: 0 })
    expect(s.byMunicipality).toEqual([])
    expect(s.byWeek).toEqual([])
  })
})
