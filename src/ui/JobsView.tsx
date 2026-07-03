import { useState } from 'react'
import type { FormEvent } from 'react'
import type { EmploymentType, Job } from '../model/types'
import { employmentTypeLabel } from '../report/activityReport'
import { buildApplication } from '../apply/buildApplication'
import { searchJobs } from '../services/jobtech'
import { useSoktStore } from '../app/store'
import { addApplicationCommand } from '../app/commands'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function ApplyPanel({ job, onDone }: { job: Job; onDone: () => void }) {
  const execute = useSoktStore((s) => s.execute)
  const [appliedAt, setAppliedAt] = useState(todayIso())
  const [surveyAnswered, setSurveyAnswered] = useState(false)
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>(
    job.employmentType === 'unknown' ? '' : job.employmentType,
  )
  const [municipality, setMunicipality] = useState(job.municipality)
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

  const channel = job.applicationChannel
  return (
    <form className="apply-panel" onSubmit={logApplication}>
      <p className="apply-channel">
        {channel.kind === 'url' && (
          <a href={channel.value} target="_blank" rel="noreferrer">
            Öppna ansökningssidan ↗
          </a>
        )}
        {channel.kind === 'email' && (
          <a href={`mailto:${channel.value}?subject=${encodeURIComponent(`Ansökan: ${job.title}`)}`}>
            Skicka ansökan via e-post ({channel.value})
          </a>
        )}
        {channel.kind === 'unknown' && (
          <a href={job.url} target="_blank" rel="noreferrer">
            Se ansökningsinstruktioner i annonsen ↗
          </a>
        )}
      </p>
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
  const [q, setQ] = useState('')
  const [ort, setOrt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openJobId, setOpenJobId] = useState<string | null>(null)

  async function search(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await searchJobs({ q, municipality: ort, limit: 25 })
      setJobs(result.jobs, result.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <form className="search-form" onSubmit={search}>
        <input
          placeholder="Yrke eller sökord, t.ex. lokalvårdare"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input placeholder="Ort, t.ex. Uppsala" value={ort} onChange={(e) => setOrt(e.target.value)} />
        <button type="submit" disabled={loading}>
          {loading ? 'Söker…' : 'Sök jobb'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {jobs.length > 0 && <p className="muted">{jobsTotal} annonser hittade, visar {jobs.length}.</p>}
      <ul className="job-list">
        {jobs.map((job) => (
          <li key={job.id} className="job-card">
            <div className="job-head">
              <div>
                <strong>{job.title}</strong>
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
        ))}
      </ul>
    </section>
  )
}
