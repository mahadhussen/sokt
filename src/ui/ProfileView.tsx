import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useSoktStore, fileStore } from '../app/store'
import { CV_REF } from '../services/fileStore'
import { setProfileCommand } from '../app/commands'

function ConsentGate() {
  const setConsent = useSoktStore((s) => s.setConsent)
  const [checked, setChecked] = useState(false)
  return (
    <section className="card">
      <h2>Samtycke</h2>
      <p className="muted">
        För att spara din profil, ditt CV och dina ansökningar behöver du samtycka till att Sökt
        lagrar dina personuppgifter. Allt sparas <strong>bara lokalt i den här webbläsaren</strong> —
        inget skickas till någon server och inget delas. Du kan när som helst exportera eller radera
        allt.
      </p>
      <label className="checkbox">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        Jag samtycker till att mina uppgifter sparas lokalt.
      </label>
      <button type="button" onClick={() => setConsent(true)} disabled={!checked}>
        Fortsätt
      </button>
    </section>
  )
}

function CvSection() {
  const cv = useSoktStore((s) => s.cv)
  const uploadCv = useSoktStore((s) => s.uploadCv)
  const removeCv = useSoktStore((s) => s.removeCv)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      await uploadCv(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function download() {
    const stored = await fileStore.loadCv()
    if (!stored) return
    const url = URL.createObjectURL(stored.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = stored.fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="card">
      <h2>CV</h2>
      {cv ? (
        <>
          <p>
            <strong>{cv.fileName}</strong>{' '}
            <span className="muted">
              ({Math.round(cv.byteSize / 1024)} kB
              {cv.text ? `, ${cv.text.length} tecken inlästa` : ', ingen text inläst'})
            </span>
          </p>
          <div className="button-row">
            <button type="button" onClick={download}>
              Ladda ner
            </button>
            <button type="button" className="ghost" onClick={() => void removeCv()}>
              Ta bort CV
            </button>
          </div>
        </>
      ) : (
        <p className="muted">Ladda upp ditt CV som PDF så har du det redo att bifoga vid varje ansökan.</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={onFile}
        disabled={busy}
        aria-label="Ladda upp CV"
      />
      {busy && <p className="muted">Läser in CV…</p>}
      {error && <p className="error">{error}</p>}
    </section>
  )
}

function DataSection() {
  const exportData = useSoktStore((s) => s.exportData)
  const deleteAll = useSoktStore((s) => s.deleteAll)
  const [confirming, setConfirming] = useState(false)

  function download() {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sokt-mina-uppgifter.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="card">
      <h2>Dina uppgifter</h2>
      <p className="muted">
        Exportera allt du sparat, eller radera det helt. Radering tar bort profil, ansökningar och CV
        från den här webbläsaren och går inte att ångra.
      </p>
      <div className="button-row">
        <button type="button" onClick={download}>
          Exportera som JSON
        </button>
        {confirming ? (
          <>
            <button type="button" className="danger" onClick={() => void deleteAll()}>
              Ja, radera allt
            </button>
            <button type="button" className="ghost" onClick={() => setConfirming(false)}>
              Avbryt
            </button>
          </>
        ) : (
          <button type="button" className="ghost danger-text" onClick={() => setConfirming(true)}>
            Radera all data
          </button>
        )}
      </div>
    </section>
  )
}

function ProfileForm() {
  const profile = useSoktStore((s) => s.profile)
  const cv = useSoktStore((s) => s.cv)
  const execute = useSoktStore((s) => s.execute)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [baseLetter, setBaseLetter] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile) return
    setFirstName(profile.firstName)
    setLastName(profile.lastName)
    setEmail(profile.email)
    setPhone(profile.details.telefon ?? '')
    setAddress(profile.details.adress ?? '')
    setCity(profile.details.ort ?? '')
    setBaseLetter(profile.baseLetter)
  }, [profile])

  function save(event: FormEvent) {
    event.preventDefault()
    execute(
      setProfileCommand({
        id: profile?.id ?? crypto.randomUUID(),
        firstName,
        lastName,
        email,
        baseLetter,
        // Keep the CV link in sync with actual CV presence, regardless of the
        // order the CV and profile were created in.
        cvFileRef: cv ? CV_REF : undefined,
        details: { ...profile?.details, telefon: phone, adress: address, ort: city },
      }),
    )
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form className="card profile-form" onSubmit={save}>
      <h2>Profil</h2>
      <div className="apply-fields">
        <label>
          Förnamn
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </label>
        <label>
          Efternamn
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </label>
        <label>
          E-post
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Telefon
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Adress
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label>
          Ort
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
      </div>
      <label>
        Personligt brev (grundversion, återanvänds vid varje ansökan)
        <textarea
          rows={8}
          value={baseLetter}
          onChange={(e) => setBaseLetter(e.target.value)}
          placeholder="Skriv ditt grundbrev en gång — det följer med i varje ansökan."
        />
      </label>
      <div className="button-row">
        <button type="submit">Spara profil</button>
        {saved && <span className="muted">Sparad ✓</span>}
      </div>
    </form>
  )
}

export function ProfileView() {
  const hydrated = useSoktStore((s) => s.hydrated)
  const consent = useSoktStore((s) => s.consent)

  if (!hydrated) return <p className="muted">Laddar…</p>
  if (!consent) return <ConsentGate />

  return (
    <div className="stack">
      <ProfileForm />
      <CvSection />
      <DataSection />
    </div>
  )
}
