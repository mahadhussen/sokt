import { useState } from 'react'
import { useSoktStore } from '../app/store'
import { useT } from '../i18n/useT'
import { uiEmploymentTypeLabel, uiSurveyLabel } from '../i18n/translations'
import { activityReport, reportToCsv, reportToText } from '../report/activityReport'

function currentMonthRange(): { start: string; end: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function ReportView() {
  const applications = useSoktStore((s) => s.applications)
  const { t, lang } = useT()
  const initial = currentMonthRange()
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [copied, setCopied] = useState(false)

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
      </div>
      {rows.length === 0 ? (
        <p className="muted">{t('report.emptyPeriod')}</p>
      ) : (
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
      )}
    </section>
  )
}
