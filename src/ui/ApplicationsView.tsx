import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSoktStore } from '../app/store'
import { addApplicationCommand, removeApplicationCommand } from '../app/commands'
import { buildManualApplication, validateManualApply } from '../apply/buildManualApplication'
import type { ManualApplyInput, ManualField } from '../apply/buildManualApplication'
import { findDuplicate } from '../apply/duplicates'
import { todayIso } from '../report/periods'
import { useT } from '../i18n/useT'
import type { EmploymentType } from '../model/types'
import { uiEmploymentTypeLabel, uiSurveyLabel } from '../i18n/translations'

// An application made outside Sökt — on the spot, over the phone, from a tip,
// from an ad found somewhere else. Without this the activity report only covers
// the applications that happened to go through this app's search box, and a
// report that omits the rest is an incomplete legal document.
function ManualApplyForm({ onDone }: { onDone: () => void }) {
  const execute = useSoktStore((s) => s.execute)
  const setNotice = useSoktStore((s) => s.setNotice)
  const applications = useSoktStore((s) => s.applications)
  const profile = useSoktStore((s) => s.profile)
  const { t } = useT()
  const [jobTitle, setJobTitle] = useState('')
  const [employerName, setEmployerName] = useState('')
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>('')
  const [appliedAt, setAppliedAt] = useState(() => todayIso(new Date()))
  const [municipality, setMunicipality] = useState(profile?.details.ort ?? '')
  const [surveyAnswered, setSurveyAnswered] = useState(false)
  const [missing, setMissing] = useState<ManualField[]>([])

  function submit(event: FormEvent) {
    event.preventDefault()
    const input: ManualApplyInput = {
      id: crypto.randomUUID(),
      jobTitle,
      employerName,
      employmentType,
      appliedAt,
      surveyAnswered,
      municipality,
    }
    const problems = validateManualApply(input)
    setMissing(problems)
    if (problems.length > 0) return
    execute(addApplicationCommand(buildManualApplication(input)))
    setNotice({ key: 'notice.logged', undoable: true })
    onDone()
  }

  const duplicate = findDuplicate(applications, {
    jobTitle,
    employerName,
    appliedAt,
  })

  const fieldError = (field: ManualField) =>
    missing.includes(field) ? <span className="error">{t('manual.required')}</span> : null

  return (
    <form className="profile-form manual-form" onSubmit={submit}>
      <p className="muted">{t('manual.intro')}</p>
      <label className="full">
        {t('table.jobTitle')}
        <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        {fieldError('jobTitle')}
      </label>
      <label className="full">
        {t('table.employer')}
        <input value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
        {fieldError('employerName')}
      </label>
      <div className="apply-fields">
        <label>
          {t('apply.employmentType')}
          <select
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as EmploymentType | '')}
          >
            <option value="" disabled>
              {t('apply.choose')}
            </option>
            <option value="heltid">{t('employment.heltid')}</option>
            <option value="deltid">{t('employment.deltid')}</option>
            <option value="timanstalld">{t('employment.timanstalld')}</option>
          </select>
          {fieldError('employmentType')}
        </label>
        <label>
          {t('apply.date')}
          <input
            type="date"
            value={appliedAt}
            onChange={(e) => setAppliedAt(e.target.value)}
          />
          {fieldError('appliedAt')}
        </label>
        <label>
          {t('apply.ort')}
          <input value={municipality} onChange={(e) => setMunicipality(e.target.value)} />
          {fieldError('municipality')}
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
        <p className="warn">{t('apply.duplicate', { date: duplicate.appliedAt })}</p>
      )}
      <div className="button-row">
        <button type="submit">{t('manual.save')}</button>
        <button type="button" className="ghost" onClick={onDone}>
          {t('data.cancel')}
        </button>
      </div>
    </form>
  )
}

export function ApplicationsView() {
  const applications = useSoktStore((s) => s.applications)
  const execute = useSoktStore((s) => s.execute)
  const setNotice = useSoktStore((s) => s.setNotice)
  const { t, lang } = useT()
  const [adding, setAdding] = useState(false)

  // Deleting is one tap and stays that way — the way back is the undo offer,
  // not a confirmation dialog in front of every delete.
  function remove(id: string) {
    execute(removeApplicationCommand(id))
    setNotice({ key: 'notice.removed', undoable: true })
  }

  return (
    <section className="stack">
      {adding ? (
        <ManualApplyForm onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="link-button add-manual" onClick={() => setAdding(true)}>
          {t('manual.add')}
        </button>
      )}

      {applications.length === 0 ? (
        <p className="muted">{t('apps.empty')}</p>
      ) : (
        // The wrapper scrolls, not the page: an eight-column table is wider than
        // a phone, and without this the whole document scrolls sideways.
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>{t('table.jobTitle')}</th>
                <th>{t('table.employer')}</th>
                <th>{t('table.employmentType')}</th>
                <th>{t('table.date')}</th>
                <th>{t('table.survey')}</th>
                <th>{t('table.ort')}</th>
                <th>{t('table.link')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td>{a.jobTitle}</td>
                  <td>{a.employerName}</td>
                  <td>{uiEmploymentTypeLabel(lang, a.employmentType)}</td>
                  <td>{a.appliedAt}</td>
                  <td>{uiSurveyLabel(lang, a.surveyAnswered)}</td>
                  <td>{a.municipality}</td>
                  <td>
                    {a.jobUrl && (
                      <a href={a.jobUrl} target="_blank" rel="noreferrer">
                        {t('job.ad')}
                      </a>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-button danger-text"
                      onClick={() => remove(a.id)}
                      aria-label={t('apps.removeAria', { title: a.jobTitle })}
                    >
                      {t('apps.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
