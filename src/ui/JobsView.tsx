import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { EmploymentType, Job } from '../model/types'
import { buildApplication } from '../apply/buildApplication'
import { appliedTo, findDuplicate } from '../apply/duplicates'
import { tailorLetter } from '../apply/tailorLetter'
import { applicantFields } from '../apply/applicantFields'
import { chooseProvider } from '../apply/letterProvider'
import { improveLetterWithAi } from '../services/letterAi'
import { canonicalOccupation } from '../jobs/taxonomy'
import { searchJobs } from '../services/jobtech'
import { searchJobLinks } from '../services/joblinks'
import { sourceHost } from '../jobs/mapJobLinksAd'
import { MUNICIPALITIES } from '../jobs/municipalities'
import { WORKTIME_EXTENTS } from '../jobs/filters'
import { newJobIds, savedSearchSummary } from '../jobs/savedSearch'
import { filterSimpleApply } from '../jobs/simpleApply'
import { suggestOccupation } from '../jobs/occupations'
import { minutesAgo } from '../jobs/freshness'
import { todayIso } from '../report/periods'
import { useSoktStore } from '../app/store'
import { addApplicationCommand } from '../app/commands'
import { useT } from '../i18n/useT'
import { uiEmploymentTypeLabel } from '../i18n/translations'
import { downloadStoredCv } from './cvDownload'

const municipalityName = (id: string) => MUNICIPALITIES.find((m) => m.id === id)?.name
const worktimeName = (id: string) => WORKTIME_EXTENTS.find((w) => w.id === id)?.label

function CopyFields() {
  const profile = useSoktStore((s) => s.profile)
  const { t } = useT()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  if (!profile) return null
  const fields = applicantFields(profile)
  if (fields.length === 0) return null

  async function copy(key: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  return (
    <div className="copy-fields">
      <span className="muted">{t('apply.yourDetails')}</span>
      <div className="copy-grid">
        {fields.map((f) => (
          <button key={f.key} type="button" className="copy-chip" onClick={() => void copy(f.key, f.value)}>
            <span className="copy-label">{t(`field.${f.key}`)}</span>
            <span className="copy-value">{copiedKey === f.key ? t('apply.copied1') : f.value}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ApplyPanel({ job, onDone }: { job: Job; onDone: () => void }) {
  const execute = useSoktStore((s) => s.execute)
  const setNotice = useSoktStore((s) => s.setNotice)
  const applications = useSoktStore((s) => s.applications)
  const profile = useSoktStore((s) => s.profile)
  const account = useSoktStore((s) => s.account)
  const cv = useSoktStore((s) => s.cv)
  const aiKey = useSoktStore((s) => s.aiKey)
  const { t } = useT()
  // Local calendar date. toISOString() would hand a participant applying after
  // midnight yesterday's date — on a report that may already have been filed.
  const [appliedAt, setAppliedAt] = useState(() => todayIso(new Date()))
  const [surveyAnswered, setSurveyAnswered] = useState(false)
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>(
    job.employmentType === 'unknown' ? '' : job.employmentType,
  )
  const [municipality, setMunicipality] = useState(job.municipality)
  const [letter, setLetter] = useState(() => (profile ? tailorLetter({ job, profile }) : ''))
  const [copied, setCopied] = useState(false)
  const [improving, setImproving] = useState(false)
  const [aiHint, setAiHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The apply flow leaks without this: tapping the send link hands the phone to
  // the mail app, and coming back nothing asks the participant to log it — so
  // the application never reaches the report. On return we ask the one question
  // that matters: did it go?
  const [awaitingSend, setAwaitingSend] = useState(false)
  const [askLogged, setAskLogged] = useState(false)
  useEffect(() => {
    if (!awaitingSend) return
    function onVisible() {
      if (document.visibilityState === 'visible') setAskLogged(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [awaitingSend])

  async function improveWithAi() {
    if (!profile) return
    if (chooseProvider(aiKey) === 'deterministic') {
      setAiHint(t('apply.aiNoKey'))
      return
    }
    setAiHint(null)
    setImproving(true)
    try {
      const improved = await improveLetterWithAi({ job, profile, currentLetter: letter, apiKey: aiKey })
      setLetter(improved)
    } catch (e) {
      setAiHint(e instanceof Error ? e.message : String(e))
    } finally {
      setImproving(false)
    }
  }

  function doLog() {
    try {
      const application = buildApplication(job, {
        id: crypto.randomUUID(),
        appliedAt,
        surveyAnswered,
        employmentType: employmentType || undefined,
        municipality: municipality || undefined,
      })
      execute(addApplicationCommand(application))
      setNotice({ key: 'notice.logged', undoable: true })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function logApplication(event: FormEvent) {
    event.preventDefault()
    doLog()
  }

  // Warn, never block: applying to the same employer twice can be deliberate,
  // and only the participant knows.
  const duplicate = findDuplicate(applications, {
    jobTitle: job.title,
    employerName: job.employer,
    appliedAt,
    jobUrl: job.url || undefined,
  })

  async function copyLetter() {
    await navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const channel = job.applicationChannel
  const mailtoBody = letter ? `&body=${encodeURIComponent(letter)}` : ''
  // Gmail öppnar annars alltid konto u/0 — för många är det jobbkontot, inte
  // adressen de söker jobb med. authuser pekar ut rätt konto; profilens mejl
  // är adressen de presenterar för arbetsgivare, så den vinner.
  const gmailUser = (profile?.email || account?.email || '').trim()
  const gmailAuth = gmailUser ? `&authuser=${encodeURIComponent(gmailUser)}` : ''
  // En länk kan aldrig bifoga en fil (webbläsarbegränsning). Näst bäst: ladda
  // ner CV:t i samma klick, så det ligger överst i filväljaren vid gemet.
  function startSend() {
    setAwaitingSend(true)
    if (cv) void downloadStoredCv()
  }
  return (
    <form className="apply-panel" onSubmit={logApplication}>
      {askLogged && (
        <div className="sent-prompt" role="status">
          <p>{t('apply.sentQuestion', { employer: job.employer })}</p>
          <div className="button-row">
            <button type="button" onClick={doLog}>
              {t('apply.sentYes')}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setAskLogged(false)
                setAwaitingSend(false)
              }}
            >
              {t('apply.sentNotYet')}
            </button>
          </div>
        </div>
      )}
      <p className="apply-channel">
        {channel.kind === 'url' && (
          <a href={channel.value} target="_blank" rel="noreferrer" onClick={() => setAwaitingSend(true)}>
            {t('apply.openUrl')}
          </a>
        )}
        {channel.kind === 'email' && (
          <span className="mail-links">
            <a
              href={`mailto:${channel.value}?subject=${encodeURIComponent(`Ansökan: ${job.title}`)}${mailtoBody}`}
              onClick={() => setAwaitingSend(true)}
            >
              {t('apply.email', { email: channel.value ?? '' })}
            </a>
            <span className="mail-alt muted">
              {t('apply.mailAlt')}{' '}
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1${gmailAuth}&to=${encodeURIComponent(channel.value ?? '')}&su=${encodeURIComponent(`Ansökan: ${job.title}`)}&body=${encodeURIComponent(letter)}`}
                target="_blank"
                rel="noreferrer"
                onClick={startSend}
              >
                Gmail
              </a>
              {' · '}
              <a
                href={`https://outlook.live.com/mail/deeplink/compose?to=${encodeURIComponent(channel.value ?? '')}&subject=${encodeURIComponent(`Ansökan: ${job.title}`)}&body=${encodeURIComponent(letter)}`}
                target="_blank"
                rel="noreferrer"
                onClick={startSend}
              >
                Outlook
              </a>
            </span>
          </span>
        )}
        {channel.kind === 'unknown' && (
          <a href={job.url} target="_blank" rel="noreferrer" onClick={() => setAwaitingSend(true)}>
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
            <button type="button" className="ghost" onClick={improveWithAi} disabled={improving}>
              {improving ? t('apply.improving') : t('apply.improveAi')}
            </button>
          </span>
          {aiHint && <span className="muted ai-hint">{aiHint}</span>}
        </label>
      ) : (
        <p className="muted">{t('apply.noProfileTip')}</p>
      )}
      {cv ? (
        <p className="muted">
          {t('apply.cvReady', { fileName: cv.fileName })}{' '}
          <button
            type="button"
            className="link-button cv-download"
            onClick={() => void downloadStoredCv()}
          >
            {t('apply.downloadCv')}
          </button>
        </p>
      ) : (
        <p className="muted">{t('apply.cvTip')}</p>
      )}
      <CopyFields />
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
      {duplicate && (
        <p className="warn">
          {t('apply.duplicate', { date: duplicate.appliedAt })}
        </p>
      )}
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
  const markSearchSeen = useSoktStore((s) => s.markSearchSeen)
  const lastSearch = useSoktStore((s) => s.lastSearch)
  const cacheLastSearch = useSoktStore((s) => s.cacheLastSearch)
  const { t } = useT()
  const [q, setQ] = useState('')
  const [municipalityId, setMunicipalityId] = useState('')
  const [worktimeExtentId, setWorktimeExtentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [simpleOnly, setSimpleOnly] = useState(true)
  const [resultSimple, setResultSimple] = useState(true)
  // Everything the search returned, before the simple-apply filter. Keeping it
  // lets us say honestly how many ads were hidden, and flip the filter without
  // a second round trip.
  const [rawJobs, setRawJobs] = useState<Job[]>([])
  const [externalJobs, setExternalJobs] = useState<Job[]>([])
  const [showExternal, setShowExternal] = useState(false)
  const [newSince, setNewSince] = useState<number | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openJobId, setOpenJobId] = useState<string | null>(null)

  const municipalityOptions = useMemo(
    () => MUNICIPALITIES.map((m) => ({ id: m.id, name: m.name })),
    [],
  )

  // Restore the last search (results + filters) on first mount, so the feed is
  // there instantly on reopen — offline included — with a "last fetched" stamp.
  useEffect(() => {
    if (searched || !lastSearch) return
    setQ(lastSearch.q)
    setMunicipalityId(lastSearch.municipalityId)
    setWorktimeExtentId(lastSearch.worktimeExtentId)
    setSimpleOnly(lastSearch.simpleOnly)
    setResultSimple(lastSearch.simpleOnly)
    setRawJobs(lastSearch.jobs)
    setJobs(
      lastSearch.simpleOnly ? filterSimpleApply(lastSearch.jobs) : lastSearch.jobs,
      lastSearch.total,
    )
    setFetchedAt(lastSearch.fetchedAt)
    setSearched(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runSearch(params: {
    q: string
    municipalityId: string
    worktimeExtentId: string
  }): Promise<Job[]> {
    setLoading(true)
    setError(null)
    try {
      // In simple-apply mode we fetch a fuller page (the API max) and then keep
      // only email-channel ads, so the user still sees a useful number of them.
      // The second source (JobAd Links) runs in parallel; its failure must
      // never break the main Platsbanken search — degrade to an empty extra
      // section instead.
      const [result, external] = await Promise.all([
        searchJobs({
          q: params.q,
          municipalityId: params.municipalityId || undefined,
          worktimeExtentId: params.worktimeExtentId || undefined,
          limit: simpleOnly ? 100 : 25,
        }),
        searchJobLinks({
          q: params.q,
          municipalityId: params.municipalityId || undefined,
        }).catch(() => []),
      ])
      const shown = simpleOnly ? filterSimpleApply(result.jobs) : result.jobs
      setRawJobs(result.jobs)
      setExternalJobs(external)
      setJobs(shown, result.total)
      setResultSimple(simpleOnly)
      setSearched(true)
      const now = Date.now()
      setFetchedAt(now)
      // Cache the unfiltered ads so the offline restore can still toggle the
      // filter — and never cache an empty result, which would restore a blank
      // feed on the next cold start.
      if (result.jobs.length > 0) {
        cacheLastSearch({
          q: params.q,
          municipalityId: params.municipalityId,
          worktimeExtentId: params.worktimeExtentId,
          simpleOnly,
          jobs: result.jobs,
          total: result.total,
          fetchedAt: now,
        })
      }
      return shown
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return []
    } finally {
      setLoading(false)
    }
  }

  function search(event: FormEvent) {
    event.preventDefault()
    setNewSince(null)
    void runSearch({ q, municipalityId, worktimeExtentId })
  }

  async function applySaved(s: (typeof savedSearches)[number]) {
    setQ(s.q)
    setMunicipalityId(s.municipalityId)
    setWorktimeExtentId(s.worktimeExtentId)
    setNewSince(null)
    const shown = await runSearch(s)
    const shownIds = shown.map((j) => j.id)
    // Only surface "new since last" once the search has been seen before.
    if (s.seenJobIds) setNewSince(newJobIds(shownIds, s.seenJobIds).length)
    markSearchSeen(s.id, shownIds)
  }

  function onSaveSearch() {
    const summary = savedSearchSummary({ q, municipalityId, worktimeExtentId }, municipalityName, worktimeName)
    const name = window.prompt(t('search.savePrompt'), summary)
    if (name === null) return
    saveSearch({ name: name.trim() || summary, q, municipalityId, worktimeExtentId })
  }

  const hasQuery = Boolean(q || municipalityId || worktimeExtentId)

  // The ads are already here, so flipping the filter is instant and costs no
  // request — and we can say up front how many it hides.
  const simpleCount = useMemo(() => filterSimpleApply(rawJobs).length, [rawJobs])

  function applySimpleOnly(next: boolean) {
    setSimpleOnly(next)
    if (!searched || rawJobs.length === 0) return
    setResultSimple(next)
    setJobs(next ? filterSimpleApply(rawJobs) : rawJobs, jobsTotal)
  }

  // The JobTech API does no diacritic folding: `stadare` returns nothing while
  // `städare` returns hundreds. Offer the spelling the participant meant rather
  // than leaving them on a dead end.
  const suggestion =
    searched && !loading && !error && rawJobs.length === 0 ? suggestOccupation(q) : null

  function runSuggestion(name: string) {
    setQ(name)
    setNewSince(null)
    void runSearch({ q: name, municipalityId, worktimeExtentId })
  }

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
      <label className="checkbox simple-toggle">
        <input
          type="checkbox"
          checked={simpleOnly}
          onChange={(e) => applySimpleOnly(e.target.checked)}
        />
        {rawJobs.length > 0
          ? t('filter.simpleApplyCount', { shown: simpleCount, fetched: rawJobs.length })
          : t('filter.simpleApply')}
      </label>
      {searched && hasQuery && (
        <button type="button" className="link-button save-search" onClick={onSaveSearch}>
          {t('search.save')}
        </button>
      )}
      {error && <p className="error">{error}</p>}
      {newSince !== null && (
        <p className="new-since">
          {newSince > 0 ? t('results.newSince', { n: newSince }) : t('results.newSinceNone')}
        </p>
      )}
      {searched && rawJobs.length > 0 && (
        <p className="muted">
          {resultSimple
            ? t('results.simpleCount', { total: jobsTotal, shown: jobs.length })
            : t('results.count', { total: jobsTotal, shown: jobs.length })}
          {fetchedAt !== null &&
            (() => {
              const mins = minutesAgo(fetchedAt, Date.now())
              const label =
                mins === 0
                  ? t('freshness.now')
                  : mins < 60
                    ? t('freshness.minutes', { n: mins })
                    : t('freshness.hours', { n: Math.floor(mins / 60) })
              return ` · ${label}`
            })()}
        </p>
      )}
      {searched && !loading && !error && rawJobs.length === 0 && (
        <div className="empty-state">
          <p className="muted">{t('results.none')}</p>
          {suggestion && (
            <button type="button" onClick={() => runSuggestion(suggestion)}>
              {t('search.didYouMean', { name: suggestion })}
            </button>
          )}
        </div>
      )}
      {searched && !loading && !error && rawJobs.length > 0 && jobs.length === 0 && (
        <div className="empty-state">
          <p className="muted">{t('results.noneSimple', { fetched: rawJobs.length })}</p>
          <button type="button" onClick={() => applySimpleOnly(false)}>
            {t('results.showAllChannels', { n: rawJobs.length })}
          </button>
        </div>
      )}
      <ul className="job-list">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            open={openJobId === job.id}
            onToggle={() => setOpenJobId(openJobId === job.id ? null : job.id)}
            onDone={() => setOpenJobId(null)}
          />
        ))}
      </ul>
      {searched && externalJobs.length > 0 && (
        <div className="external-section">
          <button
            type="button"
            className="link-button"
            onClick={() => setShowExternal((v) => !v)}
          >
            {showExternal
              ? t('external.hide')
              : t('external.show', { n: externalJobs.length })}
          </button>
          {showExternal && (
            <>
              <p className="muted">{t('external.note')}</p>
              <ul className="job-list">
                {externalJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    open={openJobId === job.id}
                    onToggle={() => setOpenJobId(openJobId === job.id ? null : job.id)}
                    onDone={() => setOpenJobId(null)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function JobCard({
  job,
  open,
  onToggle,
  onDone,
}: {
  job: Job
  open: boolean
  onToggle: () => void
  onDone: () => void
}) {
  const { t, lang } = useT()
  const applications = useSoktStore((s) => s.applications)
  const occupation = canonicalOccupation(job.taxonomy, job.title)
  const showTag = occupation.toLowerCase() !== job.title.toLowerCase()
  const host = job.source === 'joblinks' ? sourceHost(job) : ''
  // Same ad next week should not look untouched.
  const already = appliedTo(applications, job)
  return (
    <li className={already ? 'job-card job-card-applied' : 'job-card'}>
      <div className="job-head">
        <div>
          <strong>{job.title}</strong>
          {showTag && <span className="tag">{occupation}</span>}
          {host && <span className="tag tag-source">{host}</span>}
          {already && (
            <span className="tag tag-applied">
              {t('job.alreadyApplied', { date: already.appliedAt })}
            </span>
          )}
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
          <button type="button" onClick={onToggle}>
            {open ? t('job.close') : t('job.apply')}
          </button>
        </div>
      </div>
      {open && <ApplyPanel job={job} onDone={onDone} />}
    </li>
  )
}
