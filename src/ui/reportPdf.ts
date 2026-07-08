// Renders the activity report to a PDF. UI-layer concern (imports jsPDF); the
// pure row derivation stays in report/activityReport. Like the text/CSV export,
// the PDF is a government-facing document for Arbetsförmedlingen and stays in
// Swedish regardless of the UI language.

import { jsPDF } from 'jspdf'
import type { ReportRow } from '../report/activityReport'
import { employmentTypeLabel, surveyLabel } from '../report/activityReport'

const MARGIN = 16
const LINE = 6

export function buildReportPdf(rows: ReportRow[], periodStart: string, periodEnd: string): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = MARGIN

  doc.setFontSize(18)
  doc.text('Aktivitetsrapport', MARGIN, y)
  y += LINE + 2
  doc.setFontSize(11)
  doc.setTextColor(90)
  doc.text(`Period: ${periodStart} – ${periodEnd}`, MARGIN, y)
  y += LINE - 1
  doc.text(`Antal ansökningar: ${rows.length}`, MARGIN, y)
  y += LINE - 1
  doc.text('Källa: dina loggade ansökningar i Sökt. Underlag för Mina sidor.', MARGIN, y)
  doc.setTextColor(20)
  y += LINE + 2

  rows.forEach((r, i) => {
    // Each application is a two-line block: never overflows the page width,
    // and paginates cleanly regardless of how long a title or employer is.
    const needed = LINE * 3
    if (y + needed > pageHeight - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
    doc.setFontSize(12)
    const heading = `${i + 1}. ${r.jobTitle} — ${r.employerName}`
    for (const line of doc.splitTextToSize(heading, 180) as string[]) {
      doc.text(line, MARGIN, y)
      y += LINE
    }
    doc.setFontSize(10)
    doc.setTextColor(90)
    doc.text(
      `Datum: ${r.appliedAt}   ·   Anställningsform: ${employmentTypeLabel(r.employmentType)}   ·   Ort: ${r.municipality}   ·   Urvalsfrågor: ${surveyLabel(r.surveyAnswered)}`,
      MARGIN,
      y,
    )
    doc.setTextColor(20)
    y += LINE + 2
  })

  return doc
}

export function downloadReportPdf(rows: ReportRow[], periodStart: string, periodEnd: string): void {
  buildReportPdf(rows, periodStart, periodEnd).save(`aktivitetsrapport-${periodStart}--${periodEnd}.pdf`)
}
