import { useState } from 'react'
import { useSoktStore } from '../app/store'
import {
  activityReport,
  employmentTypeLabel,
  reportToCsv,
  reportToText,
  surveyLabel,
} from '../report/activityReport'

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
  const initial = currentMonthRange()
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [copied, setCopied] = useState(false)

  const rows = activityReport(applications, start, end)

  async function copyText() {
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
      <p className="muted">
        Rapporten byggs direkt från dina loggade ansökningar. Granska den och för in uppgifterna i
        Mina sidor hos Arbetsförmedlingen — Sökt skickar aldrig in något åt dig.
      </p>
      <div className="period-row">
        <label>
          Från
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          Till
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <button type="button" onClick={copyText} disabled={rows.length === 0}>
          {copied ? 'Kopierad ✓' : 'Kopiera som text'}
        </button>
        <button type="button" onClick={downloadCsv} disabled={rows.length === 0}>
          Ladda ner CSV
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="muted">Inga ansökningar i den valda perioden.</p>
      ) : (
        <table className="report-table">
          <thead>
            <tr>
              <th>Jobbtitel</th>
              <th>Arbetsgivare</th>
              <th>Anställningsform</th>
              <th>Datum</th>
              <th>Urvalsfrågor</th>
              <th>Ort</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.jobTitle}</td>
                <td>{r.employerName}</td>
                <td>{employmentTypeLabel(r.employmentType)}</td>
                <td>{r.appliedAt}</td>
                <td>{surveyLabel(r.surveyAnswered)}</td>
                <td>{r.municipality}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
