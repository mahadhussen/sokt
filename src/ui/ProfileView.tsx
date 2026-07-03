import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSoktStore } from '../app/store'
import { setProfileCommand } from '../app/commands'

export function ProfileView() {
  const profile = useSoktStore((s) => s.profile)
  const execute = useSoktStore((s) => s.execute)
  const hydrated = useSoktStore((s) => s.hydrated)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [baseLetter, setBaseLetter] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile) return
    setFirstName(profile.firstName)
    setLastName(profile.lastName)
    setEmail(profile.email)
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
        details: profile?.details ?? {},
      }),
    )
    setSaved(true)
  }

  if (!hydrated) return <p className="muted">Laddar…</p>

  return (
    <section>
      <form className="profile-form" onSubmit={save}>
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
        <button type="submit">Spara profil</button>
        {saved && <span className="muted"> Sparad ✓</span>}
      </form>
    </section>
  )
}
