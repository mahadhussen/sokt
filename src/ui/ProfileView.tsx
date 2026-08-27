import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useSoktStore } from '../app/store'
import { CV_REF } from '../services/fileStore'
import { downloadStoredCv } from './cvDownload'
import { setProfileCommand } from '../app/commands'
import { useT } from '../i18n/useT'

function ConsentGate() {
  const setConsent = useSoktStore((s) => s.setConsent)
  const { t } = useT()
  const [checked, setChecked] = useState(false)
  return (
    <section className="card">
      <h2>{t('consent.title')}</h2>
      <p className="muted">{t('consent.body')}</p>
      <label className="checkbox">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        {t('consent.checkbox')}
      </label>
      <button type="button" onClick={() => setConsent(true)} disabled={!checked}>
        {t('consent.continue')}
      </button>
    </section>
  )
}

function CvSection() {
  const cv = useSoktStore((s) => s.cv)
  const uploadCv = useSoktStore((s) => s.uploadCv)
  const removeCv = useSoktStore((s) => s.removeCv)
  const { t } = useT()
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
    await downloadStoredCv()
  }

  return (
    <section className="card">
      <h2>{t('cv.title')}</h2>
      {cv ? (
        <>
          <p>
            <strong>{cv.fileName}</strong>{' '}
            <span className="muted">
              ({Math.round(cv.byteSize / 1024)} kB
              {cv.text ? `, ${t('cv.charsRead', { n: cv.text.length })}` : `, ${t('cv.noText')}`})
            </span>
          </p>
          <div className="button-row">
            <button type="button" onClick={download}>
              {t('cv.download')}
            </button>
            <button type="button" className="ghost" onClick={() => void removeCv()}>
              {t('cv.remove')}
            </button>
          </div>
        </>
      ) : (
        <p className="muted">{t('cv.empty')}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={onFile}
        disabled={busy}
        aria-label={t('cv.uploadAria')}
      />
      {busy && <p className="muted">{t('cv.reading')}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  )
}

function DataSection() {
  const exportBackup = useSoktStore((s) => s.exportBackup)
  const importBackup = useSoktStore((s) => s.importBackup)
  const deleteAll = useSoktStore((s) => s.deleteAll)
  const { t } = useT()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      const json = await exportBackup()
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'sokt-sakerhetskopia.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const summary = await importBackup(await file.text())
      const parts = [t('data.restoredApplications', { n: summary.addedApplications })]
      if (summary.cvRestored) parts.push(t('data.restoredCv'))
      if (summary.droppedApplications > 0) {
        parts.push(t('data.restoredDropped', { n: summary.droppedApplications }))
      }
      setResult(parts.join(' '))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section className="card">
      <h2>{t('data.title')}</h2>
      <p className="muted">{t('data.body')}</p>
      <div className="button-row">
        <button type="button" onClick={() => void download()} disabled={busy}>
          {t('data.export')}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {t('data.import')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void restore(e)}
          className="hidden-file"
          aria-label={t('data.import')}
        />
        {confirming ? (
          <>
            <button type="button" className="danger" onClick={() => void deleteAll()}>
              {t('data.deleteConfirm')}
            </button>
            <button type="button" className="ghost" onClick={() => setConfirming(false)}>
              {t('data.cancel')}
            </button>
          </>
        ) : (
          <button type="button" className="ghost danger-text" onClick={() => setConfirming(true)}>
            {t('data.delete')}
          </button>
        )}
      </div>
      {result && <p className="ok-text">{result}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  )
}

function ProfileForm() {
  const profile = useSoktStore((s) => s.profile)
  const cv = useSoktStore((s) => s.cv)
  const account = useSoktStore((s) => s.account)
  const execute = useSoktStore((s) => s.execute)
  const { t } = useT()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [birthYear, setBirthYear] = useState('')
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
    setBirthYear(profile.details.fodelsear ?? '')
    setBaseLetter(profile.baseLetter)
  }, [profile])

  // Ny profil på ett inloggat konto: förifyll mejlfältet med adressen de
  // bevisligen äger (OTP-verifierad) i stället för att låta dem stava den för
  // hand. Ett stavfel här skickade en deltagares alla arbetsgivarsvar och
  // kopior till fel adress — tyst.
  useEffect(() => {
    if (!profile && account) {
      setEmail((current) => current || account.email)
    }
  }, [profile, account])

  // Avsiktligt en annan adress är tillåtet — men det ska aldrig kunna vara en
  // felstavning som ingen ser. Varna och erbjud rättning med ett tryck.
  const emailMismatch =
    account &&
    email.trim() !== '' &&
    email.trim().toLowerCase() !== account.email.trim().toLowerCase()

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
        details: {
          ...profile?.details,
          telefon: phone,
          adress: address,
          ort: city,
          fodelsear: birthYear,
        },
      }),
    )
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form className="card profile-form" onSubmit={save}>
      <h2>{t('profile.title')}</h2>
      <div className="apply-fields">
        <label>
          {t('field.firstName')}
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </label>
        <label>
          {t('field.lastName')}
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </label>
        <label>
          {t('field.email')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {emailMismatch && account && (
            <span className="email-warn">
              {t('profile.emailDiffers', { account: account.email })}{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => setEmail(account.email)}
              >
                {t('profile.useAccountEmail', { account: account.email })}
              </button>
            </span>
          )}
        </label>
        <label>
          {t('field.phone')}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          {t('field.address')}
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label>
          {t('field.city')}
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label>
          {t('field.birthYear')}
          <input
            inputMode="numeric"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="1995"
          />
        </label>
      </div>
      <label>
        {t('profile.baseLetter')}
        <textarea
          rows={8}
          value={baseLetter}
          onChange={(e) => setBaseLetter(e.target.value)}
          placeholder={t('profile.baseLetterPlaceholder')}
        />
      </label>
      <div className="button-row">
        <button type="submit">{t('profile.save')}</button>
        {saved && <span className="muted">{t('profile.saved')}</span>}
      </div>
    </form>
  )
}

function AiKeySection() {
  const aiKey = useSoktStore((s) => s.aiKey)
  const setAiKey = useSoktStore((s) => s.setAiKey)
  const { t } = useT()
  const [value, setValue] = useState(aiKey)
  const [saved, setSaved] = useState(false)

  function save() {
    setAiKey(value.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="card">
      <h2>{t('ai.title')}</h2>
      <p className="muted">{t('ai.body')}</p>
      <label className="full">
        {t('ai.keyLabel')}
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
        />
      </label>
      <div className="button-row">
        <button type="button" onClick={save}>
          {t('profile.save')}
        </button>
        {saved && <span className="muted">{t('ai.saved')}</span>}
      </div>
    </section>
  )
}

export function ProfileView() {
  const hydrated = useSoktStore((s) => s.hydrated)
  const consent = useSoktStore((s) => s.consent)
  const { t } = useT()

  if (!hydrated) return <p className="muted">{t('profile.loading')}</p>
  if (!consent) return <ConsentGate />

  return (
    <div className="stack">
      <ProfileForm />
      <CvSection />
      <AiKeySection />
      <DataSection />
    </div>
  )
}
