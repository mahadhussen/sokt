import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 8000)
    return () => clearTimeout(timer)
  }, [notice, setNotice])

  if (!notice) return null
  return (
    <div className="banner banner-ok" role="status">
      <span>{t(notice.key)}</span>
      {notice.undoable && (
        <button type="button" className="ghost" onClick={undo}>
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
      <SaveFailedBanner />
      <NoticeBar />
      {accountOpen && <AccountPanel onClose={() => setAccountOpen(false)} />}
      <nav className="tabs">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tab active' : 'tab'}
            onClick={() => setTab(id)}
          >
            {t(`tab.${id}`)}
            {id === 'ansokningar' && applicationCount > 0 && ` (${applicationCount})`}
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
