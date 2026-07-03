import { useState } from 'react'
import { JobsView } from './ui/JobsView'
import { ProfileView } from './ui/ProfileView'
import { ApplicationsView } from './ui/ApplicationsView'
import { ReportView } from './ui/ReportView'
import { useSoktStore } from './app/store'
import './index.css'

type Tab = 'jobb' | 'profil' | 'ansokningar' | 'rapport'

const TABS: { id: Tab; label: string }[] = [
  { id: 'jobb', label: 'Jobb' },
  { id: 'profil', label: 'Profil' },
  { id: 'ansokningar', label: 'Ansökningar' },
  { id: 'rapport', label: 'Aktivitetsrapport' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('jobb')
  const applicationCount = useSoktStore((s) => s.applications.length)

  return (
    <div className="app">
      <header>
        <h1>Sökt</h1>
        <p className="tagline">Sök jobb, ansök snabbt — aktivitetsrapporten bygger sig själv.</p>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'ansokningar' && applicationCount > 0 && ` (${applicationCount})`}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'jobb' && <JobsView />}
        {tab === 'profil' && <ProfileView />}
        {tab === 'ansokningar' && <ApplicationsView />}
        {tab === 'rapport' && <ReportView />}
      </main>
      <footer>
        Jobbannonser från{' '}
        <a href="https://jobtechdev.se" target="_blank" rel="noreferrer">
          Arbetsförmedlingens JobTech-API
        </a>{' '}
        (Platsbanken), data under licens CC-BY-SA.
      </footer>
    </div>
  )
}
