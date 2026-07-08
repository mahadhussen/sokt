import { describe, expect, it } from 'vitest'
import type { ReportRow } from '../report/activityReport'
import { buildReportPdf } from './reportPdf'

const rows: ReportRow[] = [
  {
    jobTitle: 'Lokalvårdare',
    employerName: 'Städ AB',
    employmentType: 'heltid',
    appliedAt: '2026-07-02',
    surveyAnswered: true,
    municipality: 'Uppsala',
  },
  {
    jobTitle: 'Diskare',
    employerName: 'Restaurang AB',
    employmentType: 'timanstalld',
    appliedAt: '2026-07-05',
    surveyAnswered: false,
    municipality: 'Stockholm',
  },
]

describe('buildReportPdf', () => {
  it('produces a non-empty PDF document', () => {
    const doc = buildReportPdf(rows, '2026-07-01', '2026-07-31')
    const out = doc.output('arraybuffer')
    expect(out.byteLength).toBeGreaterThan(500)
    // A valid PDF starts with the %PDF- magic bytes.
    const header = String.fromCharCode(...new Uint8Array(out.slice(0, 5)))
    expect(header).toBe('%PDF-')
  })

  it('paginates when there are more rows than fit one page', () => {
    const many: ReportRow[] = Array.from({ length: 60 }, (_, i) => ({
      ...rows[0],
      jobTitle: `Jobb ${i + 1}`,
    }))
    const doc = buildReportPdf(many, '2026-07-01', '2026-07-31')
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
  })

  it('handles an empty period without crashing', () => {
    const doc = buildReportPdf([], '2026-07-01', '2026-07-31')
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(300)
  })
})
