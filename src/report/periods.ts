// Reporting periods for the Arbetsförmedlingen activity report.
// Pure module: no imports from ui, render, services, or app.
//
// Two rules from the real world drive this module:
//
// 1. AF's aktivitetsrapport is filed in Mina sidor between the 1st and the
//    14th, and it covers the PREVIOUS month. During the only two weeks anyone
//    opens the report tab, "this month" is therefore the wrong default period.
//
// 2. Dates must be read from LOCAL time, never `toISOString()`. Sweden is
//    UTC+1/+2, so between midnight and 01:00/02:00 the UTC date is still
//    yesterday — an application logged then would land in the previous month's
//    report, which may already have been filed.

export interface DateRange {
  start: string
  end: string
}

// The last day of the month on which AF's report window closes.
export const REPORT_DEADLINE_DAY = 14

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Local calendar date as YYYY-MM-DD. The whole app's date format.
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayIso(now: Date): string {
  return toIsoDate(now)
}

// First and last day of a month. `month` is 0-based and may be out of range —
// -1 means December of the previous year, 12 means January of the next.
export function monthRange(year: number, month: number): DateRange {
  const first = new Date(year, month, 1)
  const y = first.getFullYear()
  const m = first.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
  }
}

// True while AF's reporting window is open (the 1st to the 14th).
export function isReportingWindow(now: Date): boolean {
  return now.getDate() <= REPORT_DEADLINE_DAY
}

// Days left to file, counting today. 0 once the window has closed.
export function daysUntilDeadline(now: Date): number {
  const left = REPORT_DEADLINE_DAY - now.getDate()
  return left >= 0 ? left : 0
}

// The period the report tab should open on: last month while the window is
// open, this month once it has closed and the user is logging for next time.
export function reportPeriod(now: Date): DateRange {
  const month = isReportingWindow(now) ? now.getMonth() - 1 : now.getMonth()
  return monthRange(now.getFullYear(), month)
}
