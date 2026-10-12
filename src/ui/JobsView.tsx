import { useEffect, useMemo, useRef, useState } from 'react'
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
import { MunicipalityCombobox } from './MunicipalityCombobox'
import type { MunicipalityComboboxHandle } from './MunicipalityCombobox'
import { WORKTIME_EXTENTS } from '../jobs/filters'
import { findSavedSearch, newJobIds } from '../jobs/savedSearch'
import { filterSimpleApply } from '../jobs/simpleApply'
import { filterCallable, isCallable, telHref } from '../jobs/callable'
import { filterSupportMentions } from '../jobs/supportMentions'
import { applyJobFilters } from '../jobs/viewFilter'
import type { JobViewFilter } from '../jobs/viewFilter'
import { suggestOccupation } from '../jobs/occupations'
import { minutesAgo } from '../jobs/freshness'
import { todayIso } from '../report/periods'
import { useSoktStore } from '../app/store'
import { addApplicationCommand } from '../app/commands'
import { useT } from '../i18n/useT'
import { uiEmploymentTypeLabel } from '../i18n/translations'
import { downloadStoredCv } from './cvDownload'
import { sendApplicationEmail, sendMailConfigured } from '../services/sendApplication'
import { connectGoogle, createGmailDraft, googleToken } from '../services/gmailDraft'
import { fileStore } from '../app/store'
import { blobToBase64 } from '../services/fileStore'

// A phone number inside translated text, bidi-isolated. In Arabic (RTL) the
// bidi algorithm reorders "054-5409920" so the segments swap around the dash
// and the reader dials a reversed number — tel: dials right, eyes read wrong.
// <bdi dir="ltr"> forces the digits to render left-to-right in every language.
// `template` is the raw translation string with a literal {phone} placeholder.
function PhoneText({ template, phone }: { template: string; phone: string }) {
  const [before, after = ''] = template.split('{phone}')
  return (
    <>
      {before}
      <bdi dir="ltr">{phone}</bdi>
      {after}
    </>
  )
}

function CopyFields() {
  const profile = useSoktStore((s) => s.profile)
  const { t } = useT()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  if (!profile) return null
  const fields = applicantFields(profile)
  if (fields.length === 0) return null

  async function copy(key: string, value: string) {
    // Urklipp kan nekas — utan besked ser ett misslyckat tryck ut exakt
    // som ett lyckat, och det som klistras in blir fel uppgift.
    try {
      await navigator.clipboard.writeText(value)
      setCopyFailed(false)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      setCopyFailed(true)
    }
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
      {copyFailed && <span className="error">{t('copy.failed')}</span>}
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

  function doLog(noticeKey = 'notice.logged') {
    try {
      const application = buildApplication(job, {
        id: crypto.randomUUID(),
        appliedAt,
        surveyAnswered,
        employmentType: employmentType || undefined,
        municipality: municipality || undefined,
      })
      execute(addApplicationCommand(application))
      setNotice({ key: noticeKey, undoable: true })
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

  const [copyLetterFailed, setCopyLetterFailed] = useState(false)
  async function copyLetter() {
    // Samma regel som alla urklippsanrop: ett nekat anrop får aldrig se ut
    // som ett lyckat.
    try {
      await navigator.clipboard.writeText(letter)
      setCopyLetterFailed(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyLetterFailed(true)
    }
  }

  const channel = job.applicationChannel
  const mailtoBody = letter ? `&body=${encodeURIComponent(letter)}` : ''
  // Gmail öppnar annars alltid konto u/0 — för många är det jobbkontot, inte
  // adressen de söker jobb med. authuser pekar ut rätt konto; profilens mejl
  // är adressen de presenterar för arbetsgivare, så den vinner.
  const gmailUser = (profile?.email || account?.email || '').trim()
  const gmailAuth = gmailUser ? `&authuser=${encodeURIComponent(gmailUser)}` : ''
  // En mejllänk kan aldrig bifoga en fil (webbläsarbegränsning). Näst bäst:
  // ladda ner CV:t i samma klick, så det ligger överst i filväljaren vid gemet.
  function startSend() {
    setAwaitingSend(true)
    if (cv) void downloadStoredCv()
  }

  // Skicka direkt från appen med CV:t bifogat på riktigt — inga manuella steg.
  // Kräver konto + CV + att servern har Resend påslaget; annars visas bara de
  // vanliga mejllänkarna precis som förut.
  const [mailConfigured, setMailConfigured] = useState(false)
  const [sendStep, setSendStep] = useState<'idle' | 'confirm' | 'sending' | 'sent'>('idle')
  const [sendError, setSendError] = useState<string | null>(null)
  useEffect(() => {
    if (account && channel.kind === 'email') {
      void sendMailConfigured().then(setMailConfigured)
    }
  }, [account, channel.kind])
  const canSendDirect =
    mailConfigured && Boolean(account) && Boolean(cv) && channel.kind === 'email' && Boolean(channel.value)

  async function sendDirect() {
    if (!channel.value) return
    setSendStep('sending')
    setSendError(null)
    try {
      await sendApplicationEmail({
        to: channel.value,
        subject: `Ansökan: ${job.title}`,
        text: letter,
      })
      setSendStep('sent')
      // Skickat på riktigt = loggat direkt. Kan fälten inte byggas (t.ex.
      // anställningsform saknas i annonsen) står frågorna redan i panelen —
      // doLog visar felet och deltagaren fyller i och loggar själv.
      doLog('notice.sentLogged')
    } catch (e) {
      setSendStep('confirm')
      setSendError(e instanceof Error ? e.message : String(e))
    }
  }

  const authConfigured = useSoktStore((s) => s.authConfigured)
  const [drafting, setDrafting] = useState(false)
  const [draftMsg, setDraftMsg] = useState<string | null>(null)
  const [draftErr, setDraftErr] = useState<string | null>(null)

  // Utkast i användarens EGEN Gmail, med PDF-CV:t bifogat. Kräver att de
  // kopplat Google en gång; utan token skickas de till Googles samtyckesskärm.
  async function draftInGmail() {
    if (channel.kind !== 'email' || !channel.value) return
    setDrafting(true)
    setDraftErr(null)
    setDraftMsg(null)
    try {
      const token = await googleToken()
      if (!token) {
        await connectGoogle() // navigerar bort till Google
        return
      }
      const stored = cv ? await fileStore.loadCv() : null
      await createGmailDraft(token, {
        to: channel.value,
        subject: `Ansökan: ${job.title}`,
        textBody: letter,
        attachment: stored
          ? {
              filename: stored.fileName,
              mimeType: 'application/pdf',
              contentBase64: await blobToBase64(stored.blob),
            }
          : undefined,
      })
      setDraftMsg(t(stored ? 'apply.draftDoneCv' : 'apply.draftDone'))
      setAwaitingSend(true)
    } catch (e) {
      setDraftErr(e instanceof Error ? e.message : String(e))
    } finally {
      setDrafting(false)
    }
  }
  return (
    <form className="apply-panel" onSubmit={logApplication}>
      {askLogged && (
        <div className="sent-prompt" role="status">
          <p>{t('apply.sentQuestion', { employer: job.employer })}</p>
          <div className="button-row">
            <button type="button" onClick={() => doLog()}>
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
      {/* Går att ringa: kontaktperson + STOR ring-knapp. Målgruppen (Rusta
          och matcha) vill kunna ringa arbetsgivaren med ett tryck — namn och
          titel kommer rakt ur annonsens application_contacts. Samma predikat
          (isCallable) som ☎-taggen och filtret, så en tagg utan knapp kan
          inte uppstå. Numret bidi-isoleras — se PhoneText. */}
      {job.contact && isCallable(job) && (
        <div className="call-block">
          <p className="call-title">{t('apply.callTitle')}</p>
          <p className="call-contact">
            <span className="call-name">{job.contact.name || job.employer}</span>
            {job.contact.title && <span className="muted"> · {job.contact.title}</span>}
          </p>
          <a className="cta cta-call" href={telHref(job.contact.telephone)}>
            ☎ <PhoneText template={t('apply.call')} phone={job.contact.telephone} />
          </a>
        </div>
      )}
      {(job.supportMentions ?? []).length > 0 && (
        <p className="support-note">
          {t('apply.supportNote', {
            forms: (job.supportMentions ?? []).map((form) => t(`support.${form}`)).join(', '),
          })}
        </p>
      )}
      {/* Ansökningsvägen — stor och blå. Ringvägen (grönt block ovanför)
          visas när annonsen bär ett ringbart nummer; övriga alternativ
          ligger nedtonade under, aldrig bredvid. */}
      <p className="apply-channel">
        {channel.kind === 'url' && (
          <a
            className="cta"
            href={channel.value}
            target="_blank"
            rel="noreferrer"
            onClick={() => setAwaitingSend(true)}
          >
            {t('apply.openUrl')}
          </a>
        )}
        {channel.kind === 'email' && canSendDirect && (
          <span className="direct-send">
            {sendStep === 'idle' && (
              <button type="button" className="cta" onClick={() => setSendStep('confirm')}>
                {t('apply.sendWithCv')}
              </button>
            )}
            {sendStep === 'confirm' && (
              <span className="send-confirm">
                <span className="muted">
                  {t('apply.sendConfirm', {
                    email: channel.value ?? '',
                    fileName: cv?.fileName ?? '',
                    reply: (profile?.email || account?.email || '').trim(),
                  })}
                </span>
                <button type="button" className="cta" onClick={() => void sendDirect()}>
                  {t('apply.sendNow')}
                </button>
                <button type="button" className="ghost" onClick={() => setSendStep('idle')}>
                  {t('apply.sendCancel')}
                </button>
              </span>
            )}
            {sendStep === 'sending' && <span className="muted">{t('apply.sending')}</span>}
            {sendError && <span className="error">{sendError}</span>}
            <span className="mail-alt muted">
              {t('apply.mailAlt')}{' '}
              <a
                href={`mailto:${channel.value}?subject=${encodeURIComponent(`Ansökan: ${job.title}`)}${mailtoBody}`}
                onClick={() => setAwaitingSend(true)}
              >
                {t('apply.email', { email: channel.value ?? '' })}
              </a>
            </span>
          </span>
        )}
        {channel.kind === 'email' && !canSendDirect && (
          <span className="mail-links">
            <a
              className="cta"
              href={`mailto:${channel.value}?subject=${encodeURIComponent(`Ansökan: ${job.title}`)}${mailtoBody}`}
              onClick={() => setAwaitingSend(true)}
            >
              {t('apply.email', { email: channel.value ?? '' })}
            </a>
            {authConfigured && (
              <span className="gmail-draft">
                <button type="button" onClick={() => void draftInGmail()} disabled={drafting}>
                  {drafting ? t('apply.drafting') : t('apply.draftInGmail')}
                </button>
                {draftMsg && <span className="ok-text">{draftMsg}</span>}
                {draftErr && <span className="error">{draftErr}</span>}
              </span>
            )}
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
          <a
            className="cta"
            href={job.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => setAwaitingSend(true)}
          >
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
          {copyLetterFailed && <span className="error">{t('copy.failed')}</span>}
          {aiHint && <span className="muted ai-hint">{aiHint}</span>}
        </label>
      ) : (
        <p className="muted">{t('apply.noProfileTip')}</p>
      )}
      {cv ? (
        <p className="muted">
          {canSendDirect
            ? t('apply.cvAuto', { fileName: cv.fileName })
            : t('apply.cvReady', { fileName: cv.fileName })}{' '}
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
      {/* Varför frågorna finns: de blir rader i aktivitetsrapporten. */}
      <p className="apply-section-title">{t('apply.forReport')}</p>
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
  const recordSearch = useSoktStore((s) => s.recordSearch)
  const removeSearch = useSoktStore((s) => s.removeSearch)
  const lastSearch = useSoktStore((s) => s.lastSearch)
  const cacheLastSearch = useSoktStore((s) => s.cacheLastSearch)
  const { t } = useT()
  const [q, setQ] = useState('')
  const [municipalityId, setMunicipalityId] = useState('')
  // Submit-vägen måste kunna finalisera ortfältet synkront (se search()).
  const ortRef = useRef<MunicipalityComboboxHandle>(null)
  const [worktimeExtentId, setWorktimeExtentId] = useState('')
  // Tomt = jobb som är ute nu. Ett datum = jobb som fanns ute den dagen,
  // inklusive annonser som hunnit tas bort sedan dess.
  const [onDate, setOnDate] = useState('')
  const [resultOnDate, setResultOnDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [simpleOnly, setSimpleOnly] = useState(true)
  const [resultSimple, setResultSimple] = useState(true)
  // Query-side filter (sent to the API — changes the result set) …
  const [openForAll, setOpenForAll] = useState(false)
  // … and the two new display filters (reshape the fetched page locally).
  const [callableOnly, setCallableOnly] = useState(false)
  const [supportOnly, setSupportOnly] = useState(false)
  // The rare filters live behind one small disclosure so the row never
  // becomes a filter wall on 375px.
  const [moreOpen, setMoreOpen] = useState(false)
  // Everything the search returned, before the simple-apply filter. Keeping it
  // lets us say honestly how many ads were hidden, and flip the filter without
  // a second round trip.
  const [rawJobs, setRawJobs] = useState<Job[]>([])
  const [externalJobs, setExternalJobs] = useState<Job[]>([])
  const [showExternal, setShowExternal] = useState(false)
  const [newSince, setNewSince] = useState<number | null>(null)
  // The tag matching the last executed search — marked in the chip row so the
  // participant sees which of their searches is on screen right now.
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openJobId, setOpenJobId] = useState<string | null>(null)

  // Restore the last search (results + filters) on first mount, so the feed is
  // there instantly on reopen — offline included — with a "last fetched" stamp.
  useEffect(() => {
    if (searched || !lastSearch) return
    setQ(lastSearch.q)
    setMunicipalityId(lastSearch.municipalityId)
    setWorktimeExtentId(lastSearch.worktimeExtentId)
    setSimpleOnly(lastSearch.simpleOnly)
    setResultSimple(lastSearch.simpleOnly)
    // Caches written before these filters existed restore with them off.
    const restoredView: JobViewFilter = {
      simpleOnly: lastSearch.simpleOnly,
      callableOnly: lastSearch.callableOnly ?? false,
      supportOnly: lastSearch.supportOnly ?? false,
    }
    setOpenForAll(lastSearch.openForAll ?? false)
    setCallableOnly(restoredView.callableOnly)
    setSupportOnly(restoredView.supportOnly)
    // The disclosure holds support + öppen för alla; open it when one of them
    // was active so a restored, effective filter is never invisible.
    if (restoredView.supportOnly || (lastSearch.openForAll ?? false)) setMoreOpen(true)
    setRawJobs(lastSearch.jobs)
    setJobs(applyJobFilters(lastSearch.jobs, restoredView), lastSearch.total)
    setFetchedAt(lastSearch.fetchedAt)
    setSearched(true)
    // The restored feed came from one of the tags? Mark it, without re-running.
    setActiveSearchId(findSavedSearch(useSoktStore.getState().savedSearches, lastSearch)?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runSearch(params: {
    q: string
    municipalityId: string
    worktimeExtentId: string
    openForAll?: boolean
    onDate?: string
  }): Promise<Job[]> {
    setLoading(true)
    setError(null)
    setNewSince(null)
    setActiveSearchId(null)
    const wantOpenForAll = Boolean(params.openForAll)
    const view: JobViewFilter = { simpleOnly, callableOnly, supportOnly }
    try {
      // With any display filter on we fetch a fuller page (the API max) and
      // then filter locally, so the user still sees a useful number of ads —
      // "går att ringa" keeps ~1 in 7, "nämner stöd" ~1 in 90 (measured).
      // The second source (JobAd Links) runs in parallel; its failure must
      // never break the main Platsbanken search — degrade to an empty extra
      // section instead.
      const anyDisplayFilter = view.simpleOnly || view.callableOnly || view.supportOnly
      const [result, external] = await Promise.all([
        searchJobs({
          q: params.q,
          municipalityId: params.municipalityId || undefined,
          worktimeExtentId: params.worktimeExtentId || undefined,
          openForAll: wantOpenForAll || undefined,
          onDate: params.onDate || undefined,
          limit: anyDisplayFilter ? 100 : 25,
        }),
        searchJobLinks({
          q: params.q,
          municipalityId: params.municipalityId || undefined,
        }).catch(() => []),
      ])
      const shown = applyJobFilters(result.jobs, view)
      setRawJobs(result.jobs)
      setExternalJobs(external)
      setJobs(shown, result.total)
      setResultSimple(view.simpleOnly)
      setResultOnDate(params.onDate ?? '')
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
          simpleOnly: view.simpleOnly,
          ...(wantOpenForAll ? { openForAll: true } : {}),
          ...(view.callableOnly ? { callableOnly: true } : {}),
          ...(view.supportOnly ? { supportOnly: true } : {}),
          jobs: result.jobs,
          total: result.total,
          fetchedAt: now,
        })
        // Every search that found something becomes (or refreshes) a tag — the
        // participant never retypes "diskare Göteborg". A search that found
        // nothing (usually a typo) never becomes a chip. "New since last" is
        // measured on the RAW result ids, never the displayed subset: the
        // display filter and page size vary between runs (simple-apply toggle,
        // limit 100 vs 25), and comparing displayed lists reported dozens of
        // "new" ads on an unchanged market. Raw against the tag's accumulated
        // seen set is apples to apples.
        const rawIds = result.jobs.map((j) => j.id)
        // En datumsökning tittar bakåt — den får aldrig räknas som "nya sedan
        // sist" eller skriva över en levande tagg med ett historiskt urval.
        if (params.onDate) return shown
        const previous = findSavedSearch(useSoktStore.getState().savedSearches, params)
        if (previous?.seenJobIds) setNewSince(newJobIds(rawIds, previous.seenJobIds).length)
        const record = recordSearch(params, rawIds)
        setActiveSearchId(record?.id ?? null)
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
    // Finalisera ortfältet FÖRE sökningen: entydig text löses till sitt
    // kommun-id ("malmo" ⇒ Malmö), felstavad/otydlig text töms. Utan detta
    // kunde Enter på en felstavning ("göteborj") eller Escape+Enter skicka
    // sökningen mot ALLA orter medan fältet fortfarande visade en ort som
    // inte filtrerade. Returvärdet används direkt i anropet — state-
    // uppdateringen från finalize hinner inte in i denna render.
    const finalizedMunicipalityId = ortRef.current?.finalize() ?? municipalityId
    void runSearch({
      q,
      municipalityId: finalizedMunicipalityId,
      worktimeExtentId,
      openForAll,
      onDate,
    })
  }

  // Tapping a tag reruns the search. Tagging, "new since last" and the active
  // mark all happen inside runSearch — one path for typed and tapped searches.
  function applySaved(s: (typeof savedSearches)[number]) {
    setQ(s.q)
    setMunicipalityId(s.municipalityId)
    setWorktimeExtentId(s.worktimeExtentId)
    setOpenForAll(Boolean(s.openForAll))
    void runSearch(s)
  }

  // The ads are already here, so flipping a display filter is instant and
  // costs no request — and we can say up front how many each one keeps.
  const simpleCount = useMemo(() => filterSimpleApply(rawJobs).length, [rawJobs])
  const callableCount = useMemo(() => filterCallable(rawJobs).length, [rawJobs])
  const supportCount = useMemo(() => filterSupportMentions(rawJobs).length, [rawJobs])

  // One path for every display-filter flip: merge, re-derive, show.
  function applyView(next: Partial<JobViewFilter>) {
    const merged: JobViewFilter = { simpleOnly, callableOnly, supportOnly, ...next }
    if (next.simpleOnly !== undefined) setSimpleOnly(next.simpleOnly)
    if (next.callableOnly !== undefined) setCallableOnly(next.callableOnly)
    if (next.supportOnly !== undefined) setSupportOnly(next.supportOnly)
    if (!searched || rawJobs.length === 0) return
    setResultSimple(merged.simpleOnly)
    setJobs(applyJobFilters(rawJobs, merged), jobsTotal)
  }

  // öppen för alla is a query parameter, not a display filter: flipping it
  // needs fresh data, so with a result on screen the search reruns directly —
  // one mental model for the participant: tap a filter, the list updates.
  function applyOpenForAll(next: boolean) {
    setOpenForAll(next)
    if (searched && !loading) {
      void runSearch({ q, municipalityId, worktimeExtentId, openForAll: next })
    }
  }

  const activeMoreFilters = (supportOnly ? 1 : 0) + (openForAll ? 1 : 0) + (onDate ? 1 : 0)

  // The JobTech API does no diacritic folding: `stadare` returns nothing while
  // `städare` returns hundreds. Offer the spelling the participant meant rather
  // than leaving them on a dead end.
  const suggestion =
    searched && !loading && !error && rawJobs.length === 0 ? suggestOccupation(q) : null

  function runSuggestion(name: string) {
    setQ(name)
    void runSearch({ q: name, municipalityId, worktimeExtentId, openForAll })
  }

  return (
    <section>
      {savedSearches.length > 0 && (
        <>
          <p className="muted saved-searches-title" id="saved-searches-title">
            {t('savedSearch.title')}
          </p>
          <div className="saved-searches" role="group" aria-labelledby="saved-searches-title">
            {savedSearches.map((s) => (
              <span key={s.id} className={s.id === activeSearchId ? 'chip chip-active' : 'chip'}>
                <button
                  type="button"
                  className="chip-main"
                  aria-current={s.id === activeSearchId ? 'true' : undefined}
                  onClick={() => applySaved(s)}
                >
                  {s.name}
                </button>
                <button
                  type="button"
                  className="chip-x"
                  aria-label={t('savedSearch.removeAria', { name: s.name })}
                  onClick={() => {
                    removeSearch(s.id)
                    if (s.id === activeSearchId) setActiveSearchId(null)
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </>
      )}
      <form className="search-form" onSubmit={search}>
        <input placeholder={t('search.qPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        <MunicipalityCombobox ref={ortRef} value={municipalityId} onChange={setMunicipalityId} />
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
      {/* Två filter i dagsljus (enkel ansökan + går att ringa — målgruppens
          två huvudvägar till arbetsgivaren), resten bakom en diskret
          utfällning så raden aldrig blir en filtervägg på 375px. */}
      <div className="filter-group">
        <label className="checkbox simple-toggle">
          <input
            type="checkbox"
            checked={simpleOnly}
            onChange={(e) => applyView({ simpleOnly: e.target.checked })}
          />
          {rawJobs.length > 0
            ? t('filter.simpleApplyCount', { shown: simpleCount, fetched: rawJobs.length })
            : t('filter.simpleApply')}
        </label>
        <label className="checkbox simple-toggle">
          <input
            type="checkbox"
            checked={callableOnly}
            onChange={(e) => applyView({ callableOnly: e.target.checked })}
          />
          {rawJobs.length > 0
            ? t('filter.callableCount', { shown: callableCount, fetched: rawJobs.length })
            : t('filter.callable')}
        </label>
        <button
          type="button"
          className="link-button more-filters-toggle"
          aria-expanded={moreOpen}
          aria-controls="more-filters-panel"
          onClick={() => setMoreOpen((v) => !v)}
        >
          {moreOpen
            ? t('filters.hide')
            : activeMoreFilters > 0
              ? t('filters.moreActive', { n: activeMoreFilters })
              : t('filters.more')}{' '}
          <span aria-hidden="true">{moreOpen ? '▴' : '▾'}</span>
        </button>
        {moreOpen && (
          <div className="more-filters" id="more-filters-panel">
            <label className="checkbox simple-toggle">
              <input
                type="checkbox"
                checked={supportOnly}
                onChange={(e) => applyView({ supportOnly: e.target.checked })}
              />
              {rawJobs.length > 0
                ? t('filter.supportCount', { shown: supportCount, fetched: rawJobs.length })
                : t('filter.support')}
            </label>
            <label className="checkbox simple-toggle">
              <input
                type="checkbox"
                checked={openForAll}
                disabled={loading}
                onChange={(e) => applyOpenForAll(e.target.checked)}
              />
              {t('filter.openForAll')}
            </label>
            <label className="date-field">
              <span className="date-label">{t('search.onDateLabel')}</span>
              <input
                type="date"
                value={onDate}
                max={todayIso(new Date())}
                onChange={(e) => setOnDate(e.target.value)}
              />
              <span className="muted date-help">{t('search.onDateHelp')}</span>
              {onDate && (
                <button type="button" className="link-button" onClick={() => setOnDate('')}>
                  {t('search.onDateClear')}
                </button>
              )}
            </label>
          </div>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {/* Första besöket ska aldrig vara en tom yta utan nästa steg. */}
      {!searched && !loading && (
        <div className="empty-state">
          <p className="muted">{t('search.hint')}</p>
        </div>
      )}
      {newSince !== null && (
        <p className="new-since">
          {newSince > 0 ? t('results.newSince', { n: newSince }) : t('results.newSinceNone')}
        </p>
      )}
      {resultOnDate && !loading && (
        <p className="banner banner-warning date-banner" role="status">
          {t('results.onDate', { date: resultOnDate })}
        </p>
      )}
      {searched && rawJobs.length > 0 && (
        <p className="muted">
          {/* "X jobb med enkel ansökan" är bara sant när enkel ansökan är det
              ENDA aktiva filtret — med ring-/stödfiltret på är den siffran
              snittet av flera filter, så då gäller den generiska raden. */}
          {resultSimple && !callableOnly && !supportOnly
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
          {/* En återvändsgränd får aldrig sakna nästa steg. Bara enkel ansökan
              på: den beprövade texten. Fler filter inblandade: säg det ärligt
              och erbjud att släppa alla visningsfilter i ett tryck. */}
          {simpleOnly && !callableOnly && !supportOnly ? (
            <>
              <p className="muted">{t('results.noneSimple', { fetched: rawJobs.length })}</p>
              <button type="button" onClick={() => applyView({ simpleOnly: false })}>
                {t('results.showAllChannels', { n: rawJobs.length })}
              </button>
            </>
          ) : (
            <>
              <p className="muted">{t('results.noneFiltered', { fetched: rawJobs.length })}</p>
              <button
                type="button"
                onClick={() =>
                  applyView({ simpleOnly: false, callableOnly: false, supportOnly: false })
                }
              >
                {t('results.clearFilters', { n: rawJobs.length })}
              </button>
            </>
          )}
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
          {/* Samma predikat som filtret och panelens ringblock — taggen
              lovar en ringknapp, så den kräver ett ringbart nummer. */}
          {isCallable(job) && <span className="tag tag-callable">☎ {t('job.callable')}</span>}
          {(job.supportMentions ?? []).map((form) => (
            // Alltid "nämner X" — textträff i annonsen, aldrig ett verifierat faktum.
            <span key={form} className="tag tag-support">
              {t('job.mentions', { form: t(`support.${form}`) })}
            </span>
          ))}
          {already && (
            <span className="tag tag-applied">
              {t('job.alreadyApplied', { date: already.appliedAt })}
            </span>
          )}
          {/* Annonsen finns inte kvar i Platsbanken — måste synas innan någon
              lägger tid på att söka ett jobb som är borta. */}
          {job.archived && <span className="tag tag-archived">{t('job.archived')}</span>}
          <div className="muted">
            {job.employer}
            {job.municipality && ` · ${job.municipality}`}
            {job.employmentType !== 'unknown' &&
              ` · ${uiEmploymentTypeLabel(lang, job.employmentType)}`}
          </div>
          {/* Datum visas bara när annonsen bär dem — ett tomt datum är värre
              än inget datum. */}
          {(job.publishedAt || job.deadline) && (
            <div className="muted job-dates">
              {job.publishedAt && (
                <span>{t('job.published', { date: job.publishedAt.slice(0, 10) })}</span>
              )}
              {job.deadline && (
                <span className="job-deadline">
                  {t('job.deadline', { date: job.deadline.slice(0, 10) })}
                </span>
              )}
            </div>
          )}
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
