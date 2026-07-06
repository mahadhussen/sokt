import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { EmploymentType, Job } from '../model/types'
import { buildApplication } from '../apply/buildApplication'
import { tailorLetter } from '../apply/tailorLetter'
import { canonicalOccupation } from '../jobs/taxonomy'
import { searchJobs } from '../services/jobtech'
import { MUNICIPALITIES } from '../jobs/municipalities'
import { WORKTIME_EXTENTS } from '../jobs/filters'
import { savedSearchSummary } from '../jobs/savedSearch'
import { useSoktStore } from '../app/store'
import { addApplicationCommand } from '../app/commands'
import { useT } from '../i18n/useT'
import { uiEmploymentTypeLabel } from '../i18n/translations'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const municipalityName = (id: string) => MUNICIPALITIES.find((m) => m.id === id)?.name
const worktimeName = (id: string) => WORKTIME_EXTENTS.find((w) => w.id === id)?.label

function ApplyPanel({ job, onDone }: { job: Job; onDone: () => void }) {
  const execute = useSoktStore((s) => s.execute)
  const profile = useSoktStore((s) => s.profile)
  const cv = useSoktStore((s) => s.cv)
  const { t } = useT()
  const [appliedAt, setAppliedAt] = useState(todayIso())
  const [surveyAnswered, setSurveyAnswered] = useState(false)
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>(
    job.employmentType === 'unknown' ? '' : job.employmentType,
  )
  const [municipality, setMunicipality] = useState(job.municipality)
  const [letter, setLetter] = useState(() => (profile ? tailorLetter({ job, profile }) : ''))
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function logApplication(event: FormEvent) {
    event.preventDefault()
    try {
      const application = buildApplication(job, {
        id: crypto.randomUUID(),
        appliedAt,
        surveyAnswered,
        employmentType: employmentType || undefined,
        municipality: municipality || undefined,
      })
      execute(addApplicationCommand(application))
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function copyLetter() {
    await navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const channel = job.applicationChannel
  const mailtoBody = letter ? `&body=${encodeURIComponent(letter)}` : ''
  return (
    <form className="apply-panel" onSubmit={logApplication}>
      <p className="apply-channel">
        {channel.kind === 'url' && (
          <a href={channel.value} target="_blank" rel="noreferrer">
            {t('apply.openUrl')}
          </a>
        )}
        {channel.kind === 'email' && (
          <a href={`mailto:${channel.value}?subject=${encodeURIComponent(`Ansökan: ${job.title}`)}${mailtoBody}`}>
            {t('apply.email', { email: channel.value ?? '' })}
          </a>
        )}
        {channel.kind === 'unknown' && (
          <a href={job.url} target="_blank" rel="noreferrer">
            {t('apply.instructions')}
          </a>
        )}
      </p>
      {profile ? (
        <label className="full">
          {t('apply.letterLabel')}
          <textarea rows={9} value={letter} onChange={(e) => setLetter(e.target.value)} />
          <span className="letter-actions">
            <button type="button" className="ghost" onClick={copyLetter}>
              {copied ? t('apply.copied') : t('apply.copyLetter')}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setLetter(tailorLetter({ job, profile }))}
            >
              {t('apply.resetLetter')}
            </button>
          </span>
        </label>
      ) : (
        <p className="muted">{t('apply.noProfileTip')}</p>
      )}
      {cv ? (
        <p className="muted">{t('apply.cvReady', { fileName: cv.fileName })}</p>
      ) : (
        <p className="muted">{t('apply.cvTip')}</p>
      )}
      <div className="apply-fields">
        <label>
          {t('apply.date')}
          <input type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} required />
        </label>
        <label>
          {t('apply.employmentType')}
          <select
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as EmploymentType | '')}
            required
          >
            <option value="" disabled>
              {t('apply.choose')}
            </option>
            <option value="heltid">{t('employment.heltid')}</option>
            <option value="deltid">{t('employment.deltid')}</option>
            <option value="timanstalld">{t('employment.timanstalld')}</option>
          </select>
        </label>
        <label>
          {t('apply.ort')}
          <input value={municipality} onChange={(e) => setMunicipality(e.target.value)} required />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={surveyAnswered}
            onChange={(e) => setSurveyAnswered(e.target.checked)}
          />
          {t('apply.surveyAnswered')}
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit">{t('apply.log')}</button>
    </form>
  )
}

export function JobsView() {
  const { jobs, jobsTotal, setJobs } = useSoktStore()
  const savedSearches = useSoktStore((s) => s.savedSearches)
  const saveSearch = useSoktStore((s) => s.saveSearch)
  const removeSearch = useSoktStore((s) => s.removeSearch)
  const { t, lang } = useT()
  const [q, setQ] = useState('')
  const [municipalityId, setMunicipalityId] = useState('')
  const [worktimeExtentId, setWorktimeExtentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openJobId, setOpenJobId] = useState<string | null>(null)

  const municipalityOptions = useMemo(
    () => MUNICIPALITIES.map((m) => ({ id: m.id, name: m.name })),
    [],
  )

  async function runSearch(params: { q: string; municipalityId: string; worktimeExtentId: string }) {
    setLoading(true)
    setError(null)
    try {
      const result = await searchJobs({
        q: params.q,
        municipalityId: params.municipalityId || undefined,
        worktimeExtentId: params.worktimeExtentId || undefined,
        limit: 25,
      })
      setJobs(result.jobs, result.total)
      setSearched(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  function search(event: FormEvent) {
    event.preventDefault()
    void runSearch({ q, municipalityId, worktimeExtentId })
  }

  function applySaved(s: (typeof savedSearches)[number]) {
    setQ(s.q)
    setMunicipalityId(s.municipalityId)
    setWorktimeExtentId(s.worktimeExtentId)
    void runSearch(s)
  }

  function onSaveSearch() {
    const summary = savedSearchSummary({ q, municipalityId, worktimeExtentId }, municipalityName, worktimeName)
    const name = window.prompt(t('search.savePrompt'), summary)
    if (name === null) return
    saveSearch({ name: name.trim() || summary, q, municipalityId, worktimeExtentId })
  }

  const hasQuery = Boolean(q || municipalityId || worktimeExtentId)

  return (
    <section>
      {savedSearches.length > 0 && (
        <div className="saved-searches">
          {savedSearches.map((s) => (
            <span key={s.id} className="chip">
              <button type="button" className="chip-main" onClick={() => applySaved(s)}>
                {s.name}
              </button>
              <button
                type="button"
                className="chip-x"
                aria-label={t('savedSearch.removeAria', { name: s.name })}
                onClick={() => removeSearch(s.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <form className="search-form" onSubmit={search}>
        <input placeholder={t('search.qPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)}>
          <option value="">{t('search.allOrter')}</option>
          {municipalityOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select value={worktimeExtentId} onChange={(e) => setWorktimeExtentId(e.target.value)}>
          <option value="">{t('search.allExtent')}</option>
          {WORKTIME_EXTENTS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading}>
          {loading ? t('search.searching') : t('search.submit')}
        </button>
      </form>
      {searched && hasQuery && (
        <button type="button" className="link-button save-search" onClick={onSaveSearch}>
          {t('search.save')}
        </button>
      )}
      {error && <p className="error">{error}</p>}
      {jobs.length > 0 && (
        <p className="muted">{t('results.count', { total: jobsTotal, shown: jobs.length })}</p>
      )}
      {searched && !loading && jobs.length === 0 && !error && (
        <p className="muted">{t('results.none')}</p>
      )}
      <ul className="job-list">
        {jobs.map((job) => {
          const occupation = canonicalOccupation(job.taxonomy, job.title)
          const showTag = occupation.toLowerCase() !== job.title.toLowerCase()
          return (
            <li key={job.id} className="job-card">
              <div className="job-head">
                <div>
                  <strong>{job.title}</strong>
                  {showTag && <span className="tag">{occupation}</span>}
                  <div className="muted">
                    {job.employer}
                    {job.municipality && ` · ${job.municipality}`}
                    {job.employmentType !== 'unknown' &&
                      ` · ${uiEmploymentTypeLabel(lang, job.employmentType)}`}
                  </div>
                </div>
                <div className="job-actions">
                  <a href={job.url} target="_blank" rel="noreferrer">
                    {t('job.ad')}
                  </a>
                  <button type="button" onClick={() => setOpenJobId(openJobId === job.id ? null : job.id)}>
                    {openJobId === job.id ? t('job.close') : t('job.apply')}
                  </button>
                </div>
              </div>
              {openJobId === job.id && <ApplyPanel job={job} onDone={() => setOpenJobId(null)} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
