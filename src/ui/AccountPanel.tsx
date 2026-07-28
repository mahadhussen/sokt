import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSoktStore } from '../app/store'
import { useT } from '../i18n/useT'
import { CODE_LENGTH, isCompleteCode, isValidEmail, normalizeCode, normalizeEmail } from '../model/credentials'

// Signing in is optional and exists for one reason: to move a participant's own
// applications between devices — the broken phone, the cleared browser, the
// shared computer at the provider's office.
//
// No password. A password is the single biggest drop-off for this audience:
// inventing one, remembering it, and recovering it are three separate ways to
// be locked out. A 6-digit code to the address they already have is one step,
// and it is the same mental model as the codes they get from their bank.
export function AccountPanel({ onClose }: { onClose: () => void }) {
  const account = useSoktStore((s) => s.account)
  const sendCode = useSoktStore((s) => s.sendCode)
  const verifyCode = useSoktStore((s) => s.verifyCode)
  const signOut = useSoktStore((s) => s.signOut)
  const syncing = useSoktStore((s) => s.syncing)
  const syncError = useSoktStore((s) => s.syncError)
  const syncedAt = useSoktStore((s) => s.syncedAt)
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function requestCode(event: FormEvent) {
    event.preventDefault()
    if (!isValidEmail(email)) {
      setError(t('account.badEmail'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await sendCode(normalizeEmail(email))
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await verifyCode(normalizeEmail(email), normalizeCode(code))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (account) {
    return (
      <section className="card account-panel">
        <h2>{t('account.title')}</h2>
        <p className="muted">{t('account.signedInAs', { email: account.email })}</p>
        <p className="muted">{t('account.syncExplained')}</p>
        {syncing && <p className="muted">{t('account.syncing')}</p>}
        {!syncing && syncError && <p className="warn">{t('account.syncFailed')}</p>}
        {!syncing && !syncError && syncedAt !== null && (
          <p className="ok-text">{t('account.synced')}</p>
        )}
        <div className="button-row">
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void signOut()
                .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
                .finally(() => setBusy(false))
            }}
          >
            {t('account.signOut')}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            {t('account.close')}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
    )
  }

  // The forms carry noValidate on purpose. `type="email"` stays, because it
  // gives the right phone keyboard — but the browser's own validation bubble
  // appears in the BROWSER's language, so an Arabic or Somali speaker on a
  // Swedish phone would be corrected in Swedish. Our own message is translated.
  return (
    <section className="card account-panel">
      <h2>{t('account.title')}</h2>
      {!sent ? (
        <form className="account-form" onSubmit={requestCode} noValidate>
          <p className="muted">{t('account.intro')}</p>
          <label className="full">
            {t('field.email')}
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="namn@exempel.se"
            />
          </label>
          <div className="button-row">
            <button type="submit" disabled={busy}>
              {busy ? t('account.sending') : t('account.sendCode')}
            </button>
            <button type="button" className="ghost" onClick={onClose}>
              {t('account.close')}
            </button>
          </div>
        </form>
      ) : (
        <form className="account-form" onSubmit={submitCode} noValidate>
          <p className="muted">{t('account.codeSent', { email: normalizeEmail(email) })}</p>
          <label className="full">
            {t('account.codeLabel')}
            <input
              // A numeric keypad and the OS one-time-code autofill: on a phone
              // this is the difference between one tap and switching apps to
              // copy six digits by hand.
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH + 5}
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              placeholder="123456"
              className="code-input"
            />
          </label>
          <div className="button-row">
            <button type="submit" disabled={busy || !isCompleteCode(code)}>
              {busy ? t('account.verifying') : t('account.signIn')}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={busy}
              onClick={() => {
                setSent(false)
                setCode('')
                setError(null)
              }}
            >
              {t('account.changeEmail')}
            </button>
          </div>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <p className="muted small">{t('account.optional')}</p>
    </section>
  )
}
