import { useState } from 'react'
import { useSoktStore } from '../app/store'
import { useT } from '../i18n/useT'
import { uiEmploymentTypeLabel } from '../i18n/translations'
import type { Lang } from '../i18n/translations'
import { activityReport } from '../report/activityReport'
import { applicationStats } from '../report/applicationStats'
import type { Count } from '../report/applicationStats'
import { reportPeriod } from '../report/periods'
import type { EmploymentType } from '../model/types'

function BarList({ items, max }: { items: { label: string; count: number }[]; max: number }) {
  return (
    <div className="bar-list">
      {items.map((it) => (
        <div key={it.label} className="bar-row">
          <span className="bar-label">{it.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${max ? (it.count / max) * 100 : 0}%` }} />
          </span>
          <span className="bar-count">{it.count}</span>
        </div>
      ))}
    </div>
  )
}

export function OverviewView() {
  const applications = useSoktStore((s) => s.applications)
  const { t, lang } = useT()
  // Same period as the report tab, so the coach conversation and the document
  // being filed never disagree about which month they are looking at.
  const [initial] = useState(() => reportPeriod(new Date()))
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)

  const rows = activityReport(applications, start, end)
  const stats = applicationStats(rows)

  const typeItems = (['heltid', 'deltid', 'timanstalld'] as EmploymentType[])
    .map((key) => ({ label: uiEmploymentTypeLabel(lang as Lang, key), count: stats.byEmploymentType[key] }))
    .filter((it) => it.count > 0)
  const muniItems = stats.byMunicipality.map((c: Count) => ({ label: c.key, count: c.count }))
  const weekItems = stats.byWeek.map((c: Count) => ({ label: c.key, count: c.count }))
  const maxType = Math.max(1, ...typeItems.map((i) => i.count))
  const maxMuni = Math.max(1, ...muniItems.map((i) => i.count))
  const maxWeek = Math.max(1, ...weekItems.map((i) => i.count))

  return (
    <section className="stack">
      <p className="muted">{t('overview.intro')}</p>
      <div className="period-row">
        <label>
          {t('report.from')}
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          {t('report.to')}
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      {stats.total === 0 ? (
        <p className="muted">{t('overview.empty')}</p>
      ) : (
        <>
          <div className="stat-cards">
            <div className="stat-card">
              <span className="stat-number">{stats.total}</span>
              <span className="stat-label">{t('overview.total')}</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.surveyAnswered}</span>
              <span className="stat-label">{t('overview.survey')}</span>
            </div>
          </div>

          <section className="card">
            <h2>{t('overview.byType')}</h2>
            <BarList items={typeItems} max={maxType} />
          </section>

          <section className="card">
            <h2>{t('overview.byMunicipality')}</h2>
            <BarList items={muniItems} max={maxMuni} />
          </section>

          <section className="card">
            <h2>{t('overview.byWeek')}</h2>
            <BarList items={weekItems} max={maxWeek} />
          </section>
        </>
      )}
    </section>
  )
}
