import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { JobsView } from './ui/JobsView'
import { ProfileView } from './ui/ProfileView'
import { ApplicationsView } from './ui/ApplicationsView'
import { ReportView } from './ui/ReportView'
import { OverviewView } from './ui/OverviewView'
import { AccountPanel } from './ui/AccountPanel'
import { useSoktStore } from './app/store'
import { useT } from './i18n/useT'
import { LANGUAGES, dirFor } from './i18n/translations'
import type { Lang } from './i18n/translations'
import './index.css'

type Tab = 'jobb' | 'profil' | 'ansokningar' | 'rapport' | 'oversikt'

const TABS: Tab[] = ['jobb', 'profil', 'ansokningar', 'rapport', 'oversikt']

// Ikonerna gör flikarna igenkännbara även för den som läser långsamt eller
// på ett annat språk — samma mentala modell som apparna målgruppen redan kan.
const TAB_ICONS: Record<Tab, ReactNode> = {
  jobb: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  profil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  ),
  ansokningar: (
    // rtl-flip: pappersflygplanet pekar i läsriktningen, som i mejl- och
    // chattapparna målgruppen redan använder.
    <svg className="rtl-flip" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </svg>
  ),
  rapport: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  ),
  oversikt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  ),
}

// Stored data existed but could not be read. Nothing has been deleted — the
// raw bytes were set aside before the app started writing over them — so say
// that plainly and hand the file back rather than letting a participant think
// their whole application history is gone.
function RecoveryBanner() {
  const backupJson = useSoktStore((s) => s.backupJson)
  const { t } = useT()

  function download() {
    if (!backupJson) return
    const url = URL.createObjectURL(new Blob([backupJson], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'sokt-sakerhetskopia.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="banner banner-warning" role="alert">
      <strong>{t('storage.brokenTitle')}</strong>
      <p>{t('storage.brokenBody')}</p>
      {backupJson && (
        <button type="button" onClick={download}>
          {t('storage.downloadBackup')}
        </button>
      )}
    </div>
  )
}

// Confirmation that something happened, with a way back. Logging an application
// used to collapse the panel with no signal at all, and deleting one was a
// single irreversible tap — while undo() sat implemented and unreachable.
function NoticeBar() {
  const notice = useSoktStore((s) => s.notice)
  const setNotice = useSoktStore((s) => s.setNotice)
  const undo = useSoktStore((s) => s.undo)
  const { t } = useT()

  // 15 sekunder, inte 8: målgruppen läser ofta på sitt andra eller tredje
  // språk. Timern pausar dessutom vid pekning/fokus på toasten, så den som
  // hunnit fram till Ångra aldrig får knappen bortryckt under fingret.
  const timerRef = useRef<number | null>(null)
  function pauseTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  function armTimer() {
    pauseTimer()
    timerRef.current = window.setTimeout(() => setNotice(null), 15000)
  }

  useEffect(() => {
    if (!notice) return
    armTimer()
    return pauseTimer
    // armTimer/pauseTimer är stabila per definition (ref-baserade).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice])

  if (!notice) return null
  // Fast nedtill, inte en rad i sidtoppen: den som loggar en ansökan långt ner
  // i listan ska se kvittot utan att skrolla.
  return (
    <div
      className="toast"
      role="status"
      onPointerEnter={pauseTimer}
      onPointerLeave={armTimer}
      onFocusCapture={pauseTimer}
      onBlurCapture={armTimer}
    >
      <span>{t(notice.key)}</span>
      {notice.undoable && (
        <button
          type="button"
          className="ghost"
          onClick={() => {
            // Tystnad efter Ångra är samma fel som tystnad efter Logga —
            // kvittera att det ångrades.
            undo()
            setNotice({ key: 'notice.undone', undoable: false })
          }}
        >
          {t('notice.undo')}
        </button>
      )}
    </div>
  )
}

// The one write that silently failed used to look exactly like a successful
// one. If persistence is broken the participant has to know before they build a
// month of applications on top of it.
function SaveFailedBanner() {
  const saveFailed = useSoktStore((s) => s.saveFailed)
  const { t } = useT()
  if (!saveFailed) return null
  return (
    <div className="banner banner-warning" role="alert">
      <strong>{t('save.failedTitle')}</strong>
      <p>{t('save.failedBody')}</p>
    </div>
  )
}

// Enhetens okopplade data när ett konto loggar in: fråga, flytta aldrig
// automatiskt. På en delad dator kan datan tillhöra någon annan — det var
// exakt så en persons CV blev synligt i någon annans inloggning.
function ClaimBanner() {
  const claimOffer = useSoktStore((s) => s.claimOffer)
  const claimDeviceData = useSoktStore((s) => s.claimDeviceData)
  const dismissClaim = useSoktStore((s) => s.dismissClaim)
  const { t } = useT()
  if (!claimOffer) return null
  return (
    <div className="banner banner-warning" role="alert">
      <strong>{t('claim.title')}</strong>
      <p>{t(claimOffer.hasCv ? 'claim.bodyCv' : 'claim.body', { n: claimOffer.apps })}</p>
      <div className="button-row">
        <button type="button" onClick={() => void claimDeviceData()}>
          {t('claim.yes')}
        </button>
        <button type="button" className="ghost" onClick={dismissClaim}>
          {t('claim.no')}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('jobb')
  const [accountOpen, setAccountOpen] = useState(false)
  const applicationCount = useSoktStore((s) => s.applications.length)
  const loadError = useSoktStore((s) => s.loadError)
  const account = useSoktStore((s) => s.account)
  const authConfigured = useSoktStore((s) => s.authConfigured)
  const setLang = useSoktStore((s) => s.setLang)
  const { t, lang } = useT()

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dirFor(lang)
  }, [lang])

  return (
    <div className="app">
      <header>
        <div className="header-row">
          <h1>Sökt</h1>
          {authConfigured && (
            <button
              type="button"
              className="link-button account-link"
              onClick={() => setAccountOpen((v) => !v)}
            >
              {account ? t('account.signedIn') : t('account.signIn')}
            </button>
          )}
          <select
            className="lang-select"
            aria-label={t('lang.aria')}
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <p className="tagline">{t('tagline')}</p>
      </header>
      {loadError && <RecoveryBanner />}
      <ClaimBanner />
      <SaveFailedBanner />
      <NoticeBar />
      {accountOpen && <AccountPanel onClose={() => setAccountOpen(false)} />}
      <nav className="tabs">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tab active' : 'tab'}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <span className="tab-icon">
              {TAB_ICONS[id]}
              {id === 'ansokningar' && applicationCount > 0 && (
                <span className="tab-badge">{applicationCount}</span>
              )}
            </span>
            <span className="tab-label">{t(`tab.${id}`)}</span>
          </button>
        ))}
      </nav>
      <main>
        {tab === 'jobb' && <JobsView />}
        {tab === 'profil' && <ProfileView />}
        {tab === 'ansokningar' && <ApplicationsView />}
        {tab === 'rapport' && <ReportView />}
        {tab === 'oversikt' && <OverviewView />}
      </main>
      <footer>
        {t('footer.pre')}{' '}
        <a href="https://jobtechdev.se" target="_blank" rel="noreferrer">
          {t('footer.link')}
        </a>{' '}
        {t('footer.post')}
      </footer>
    </div>
  )
}
