import { useSoktStore } from '../app/store'
import { employmentTypeLabel, surveyLabel } from '../report/activityReport'

export function ApplicationsView() {
  const applications = useSoktStore((s) => s.applications)

  if (applications.length === 0) {
    return <p className="muted">Inga loggade ansökningar ännu. Sök jobb och ansök så hamnar de här.</p>
  }

  return (
    <table className="report-table">
      <thead>
        <tr>
          <th>Jobbtitel</th>
          <th>Arbetsgivare</th>
          <th>Anställningsform</th>
          <th>Datum</th>
          <th>Urvalsfrågor</th>
          <th>Ort</th>
          <th>Länk</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((a) => (
          <tr key={a.id}>
            <td>{a.jobTitle}</td>
            <td>{a.employerName}</td>
            <td>{employmentTypeLabel(a.employmentType)}</td>
            <td>{a.appliedAt}</td>
            <td>{surveyLabel(a.surveyAnswered)}</td>
            <td>{a.municipality}</td>
            <td>
              {a.jobUrl && (
                <a href={a.jobUrl} target="_blank" rel="noreferrer">
                  Annons ↗
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
