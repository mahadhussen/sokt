import { useEffect, useState } from 'react'
import { JobsView } from './ui/JobsView'
import { ProfileView } from './ui/ProfileView'
import { ApplicationsView } from './ui/ApplicationsView'
import { ReportView } from './ui/ReportView'
import { OverviewView } from './ui/OverviewView'
import { useSoktStore } from './app/store'
import { useT } from './i18n/useT'
import { LANGUAGES, dirFor } from './i18n/translations'
import type { Lang } from './i18n/translations'
import './index.css'

type Tab = 'jobb' | 'profil' | 'ansokningar' | 'rapport' | 'oversikt'

const TABS: Tab[] = ['jobb', 'profil', 'ansokningar', 'rapport', 'oversikt']

export default function App() {
  const [tab, setTab] = useState<Tab>('jobb')
  const applicationCount = useSoktStore((s) => s.applications.length)
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
