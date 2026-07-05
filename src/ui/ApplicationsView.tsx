import { useSoktStore } from '../app/store'
import { removeApplicationCommand } from '../app/commands'
import { useT } from '../i18n/useT'
import { uiEmploymentTypeLabel, uiSurveyLabel } from '../i18n/translations'

export function ApplicationsView() {
  const applications = useSoktStore((s) => s.applications)
  const execute = useSoktStore((s) => s.execute)
  const { t, lang } = useT()

  if (applications.length === 0) {
    return <p className="muted">{t('apps.empty')}</p>
  }

  return (
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
                onClick={() => execute(removeApplicationCommand(a.id))}
                aria-label={t('apps.removeAria', { title: a.jobTitle })}
              >
                {t('apps.remove')}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
