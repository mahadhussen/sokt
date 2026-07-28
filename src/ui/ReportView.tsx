import { useState } from 'react'
import { useSoktStore } from '../app/store'
import { useT } from '../i18n/useT'
import { uiEmploymentTypeLabel, uiSurveyLabel } from '../i18n/translations'
import { activityReport, reportToCsv, reportToText } from '../report/activityReport'
import { daysUntilDeadline, isReportingWindow, reportPeriod } from '../report/periods'

export function ReportView() {
  const applications = useSoktStore((s) => s.applications)
  const { t, lang } = useT()
  // AF's report is filed the 1st to the 14th and covers the PREVIOUS month —
  // so during the reporting window that is the period to open on.
  const now = new Date()
  const [initial] = useState(() => reportPeriod(now))
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [copied, setCopied] = useState(false)
  const inWindow = isReportingWindow(now)
  const daysLeft = daysUntilDeadline(now)

  const rows = activityReport(applications, start, end)

  async function copyText() {
    // The official AF report export stays Swedish regardless of UI language.
    await navigator.clipboard.writeText(reportToText(rows))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadCsv() {
    const blob = new Blob([`﻿${reportToCsv(rows)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aktivitetsrapport-${start}--${end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section>
      <p className="muted">{t('report.intro')}</p>
      {inWindow && (
        <p className="deadline">
          {daysLeft > 0 ? t('report.deadline', { n: daysLeft }) : t('report.deadlineLastDay')}
        </p>
      )}
      <div className="period-row">
        <label>
          {t('report.from')}
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          {t('report.to')}
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <button type="button" onClick={copyText} disabled={rows.length === 0}>
          {copied ? t('report.copied') : t('report.copy')}
        </button>
        <button type="button" onClick={downloadCsv} disabled={rows.length === 0}>
          {t('report.downloadCsv')}
        </button>
        <button
          type="button"
          onClick={() => {
            // jsPDF is large; load it only when a PDF is actually requested.
            void import('./reportPdf').then((m) => m.downloadReportPdf(rows, start, end))
          }}
          disabled={rows.length === 0}
        >
          {t('report.downloadPdf')}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{t('report.emptyPeriod')}</p>
      ) : (
        // The wrapper scrolls, not the page — a six-column table is wider than
        // a phone screen.
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>{t('table.jobTitle')}</th>
                <th>{t('table.employer')}</th>
                <th>{t('table.employmentType')}</th>
                <th>{t('table.date')}</th>
                <th>{t('table.survey')}</th>
                <th>{t('table.ort')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.jobTitle}</td>
                  <td>{r.employerName}</td>
                  <td>{uiEmploymentTypeLabel(lang, r.employmentType)}</td>
                  <td>{r.appliedAt}</td>
                  <td>{uiSurveyLabel(lang, r.surveyAnswered)}</td>
                  <td>{r.municipality}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
