import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { EmploymentType, Job } from '../model/types'
import { employmentTypeLabel } from '../report/activityReport'
import { buildApplication } from '../apply/buildApplication'
import { tailorLetter } from '../apply/tailorLetter'
import { canonicalOccupation } from '../jobs/taxonomy'
import { searchJobs } from '../services/jobtech'
import { MUNICIPALITIES } from '../jobs/municipalities'
import { WORKTIME_EXTENTS } from '../jobs/filters'
import { savedSearchSummary } from '../jobs/savedSearch'
import { useSoktStore } from '../app/store'
import { addApplicationCommand } from '../app/commands'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const municipalityName = (id: string) => MUNICIPALITIES.find((m) => m.id === id)?.name
const worktimeName = (id: string) => WORKTIME_EXTENTS.find((w) => w.id === id)?.label

function ApplyPanel({ job, onDone }: { job: Job; onDone: () => void }) {
  const execute = useSoktStore((s) => s.execute)
  const profile = useSoktStore((s) => s.profile)
  const cv = useSoktStore((s) => s.cv)
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
            Öppna ansökningssidan ↗
          </a>
        )}
        {channel.kind === 'email' && (
          <a href={`mailto:${channel.value}?subject=${encodeURIComponent(`Ansökan: ${job.title}`)}${mailtoBody}`}>
            Skicka ansökan via e-post ({channel.value})
          </a>
        )}
        {channel.kind === 'unknown' && (
          <a href={job.url} target="_blank" rel="noreferrer">
            Se ansökningsinstruktioner i annonsen ↗
          </a>
        )}
      </p>
      {profile ? (
        <label className="full">
          Personligt brev (anpassat för den här tjänsten)
          <textarea rows={9} value={letter} onChange={(e) => setLetter(e.target.value)} />
          <span className="letter-actions">
            <button type="button" className="ghost" onClick={copyLetter}>
              {copied ? 'Kopierat ✓' : 'Kopiera brev'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setLetter(tailorLetter({ job, profile }))}
            >
              Återställ från grundbrev
            </button>
          </span>
        </label>
      ) : (
        <p className="muted">Tips: fyll i din profil och ditt grundbrev så anpassas brevet per jobb.</p>
      )}
      {cv ? (
        <p className="muted">CV redo att bifoga: {cv.fileName}. Bifoga det i kanalen ovan.</p>
      ) : (
        <p className="muted">Tips: ladda upp ditt CV under Profil så har du det redo att bifoga.</p>
      )}
      <div className="apply-fields">
        <label>
          Datum
          <input type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} required />
        </label>
        <label>
          Anställningsform
          <select
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as EmploymentType | '')}
            required
          >
            <option value="" disabled>
              Välj…
            </option>
            <option value="heltid">Heltid</option>
            <option value="deltid">Deltid</option>
            <option value="timanstalld">Timanställd</option>
          </select>
        </label>
        <label>
          Ort
          <input value={municipality} onChange={(e) => setMunicipality(e.target.value)} required />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={surveyAnswered}
            onChange={(e) => setSurveyAnswered(e.target.checked)}
          />
          Besvarade urvalsfrågor
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit">Logga ansökan</button>
    </form>
  )
}

export function JobsView() {
  const { jobs, jobsTotal, setJobs } = useSoktStore()
  const savedSearches = useSoktStore((s) => s.savedSearches)
  const saveSearch = useSoktStore((s) => s.saveSearch)
  const removeSearch = useSoktStore((s) => s.removeSearch)
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
    const name = window.prompt('Namn på sökningen', summary)
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
                aria-label={`Ta bort sparad sökning: ${s.name}`}
                onClick={() => removeSearch(s.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <form className="search-form" onSubmit={search}>
        <input
          placeholder="Yrke eller sökord, t.ex. lokalvårdare"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)}>
          <option value="">Alla orter</option>
          {municipalityOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select value={worktimeExtentId} onChange={(e) => setWorktimeExtentId(e.target.value)}>
          <option value="">All omfattning</option>
          {WORKTIME_EXTENTS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading}>
          {loading ? 'Söker…' : 'Sök jobb'}
        </button>
      </form>
      {searched && hasQuery && (
        <button type="button" className="link-button save-search" onClick={onSaveSearch}>
          + Spara sökningen
        </button>
      )}
      {error && <p className="error">{error}</p>}
      {jobs.length > 0 && (
        <p className="muted">
          {jobsTotal} annonser hittade, visar {jobs.length}.
        </p>
      )}
      {searched && !loading && jobs.length === 0 && !error && (
        <p className="muted">Inga annonser matchade sökningen. Prova andra filter.</p>
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
                      ` · ${employmentTypeLabel(job.employmentType)}`}
                  </div>
                </div>
                <div className="job-actions">
                  <a href={job.url} target="_blank" rel="noreferrer">
                    Annons ↗
                  </a>
                  <button type="button" onClick={() => setOpenJobId(openJobId === job.id ? null : job.id)}>
                    {openJobId === job.id ? 'Stäng' : 'Ansök'}
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
