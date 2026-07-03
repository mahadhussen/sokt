import { describe, expect, it } from 'vitest'
import type { Application } from '../model/types'
import { activityReport, reportToCsv, reportToText } from './activityReport'

function app(overrides: Partial<Application>): Application {
  return {
    id: 'a1',
    jobTitle: 'Lokalvårdare',
    employerName: 'Städ AB',
    employmentType: 'deltid',
    appliedAt: '2026-07-02',
    surveyAnswered: false,
    municipality: 'Uppsala',
    channel: 'url:https://example.se/apply',
    jobUrl: 'https://arbetsformedlingen.se/platsbanken/annonser/1',
    status: 'sent',
    ...overrides,
  }
}

describe('activityReport', () => {
  it('includes only sent applications inside the period, inclusive bounds', () => {
    const rows = activityReport(
      [
        app({ id: 'inside', appliedAt: '2026-07-02' }),
        app({ id: 'start', appliedAt: '2026-07-01' }),
        app({ id: 'end', appliedAt: '2026-07-31' }),
        app({ id: 'before', appliedAt: '2026-06-30' }),
        app({ id: 'after', appliedAt: '2026-08-01' }),
        app({ id: 'draft', appliedAt: '2026-07-10', status: 'draft' }),
      ],
      '2026-07-01',
      '2026-07-31',
    )
    expect(rows.map((r) => r.appliedAt)).toEqual(['2026-07-01', '2026-07-02', '2026-07-31'])
  })

  it('derives every AF field from the Application record only', () => {
    const rows = activityReport([app({})], '2026-07-01', '2026-07-31')
    expect(rows[0]).toEqual({
      jobTitle: 'Lokalvårdare',
      employerName: 'Städ AB',
      employmentType: 'deltid',
      appliedAt: '2026-07-02',
      surveyAnswered: false,
      municipality: 'Uppsala',
      jobUrl: 'https://arbetsformedlingen.se/platsbanken/annonser/1',
    })
  })

  it('sorts rows by date', () => {
    const rows = activityReport(
      [app({ appliedAt: '2026-07-20' }), app({ appliedAt: '2026-07-05' })],
      '2026-07-01',
      '2026-07-31',
    )
    expect(rows.map((r) => r.appliedAt)).toEqual(['2026-07-05', '2026-07-20'])
  })
})

describe('report export', () => {
  const rows = activityReport([app({})], '2026-07-01', '2026-07-31')

  it('renders the six AF fields as text', () => {
    const text = reportToText(rows)
    expect(text).toContain('Jobbtitel: Lokalvårdare')
    expect(text).toContain('Arbetsgivare: Städ AB')
    expect(text).toContain('Anställningsform: Deltid')
    expect(text).toContain('Datum: 2026-07-02')
    expect(text).toContain('Besvarat urvalsfrågor: Nej')
    expect(text).toContain('Ort: Uppsala')
  })

  it('renders csv with header and escaping', () => {
    const csv = reportToCsv(
      activityReport([app({ employerName: 'Bygg; "Smide" AB' })], '2026-07-01', '2026-07-31'),
    )
    const [header, line] = csv.split('\n')
    expect(header).toBe(
      'Jobbtitel;Arbetsgivare;Anställningsform;Datum;Besvarat urvalsfrågor;Ort;Länk',
    )
    expect(line).toContain('"Bygg; ""Smide"" AB"')
  })
})
