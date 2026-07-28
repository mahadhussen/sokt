import { describe, expect, it } from 'vitest'
import {
  daysUntilDeadline,
  isReportingWindow,
  monthRange,
  reportPeriod,
  toIsoDate,
  todayIso,
} from './periods'

describe('toIsoDate', () => {
  it('reads the local calendar date, not UTC', () => {
    // 00:20 local. toISOString() would give the previous day in Sweden.
    expect(toIsoDate(new Date(2026, 7, 1, 0, 20))).toBe('2026-08-01')
    expect(toIsoDate(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01')
  })

  it('pads month and day', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
    expect(todayIso(new Date(2026, 10, 30, 12))).toBe('2026-11-30')
  })
})

describe('monthRange', () => {
  it('spans the whole month', () => {
    expect(monthRange(2026, 6)).toEqual({ start: '2026-07-01', end: '2026-07-31' })
    expect(monthRange(2026, 3)).toEqual({ start: '2026-04-01', end: '2026-04-30' })
  })

  it('handles February in a leap year', () => {
    expect(monthRange(2028, 1)).toEqual({ start: '2028-02-01', end: '2028-02-29' })
    expect(monthRange(2026, 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })

  it('rolls the year over for an out-of-range month', () => {
    expect(monthRange(2026, -1)).toEqual({ start: '2025-12-01', end: '2025-12-31' })
    expect(monthRange(2026, 12)).toEqual({ start: '2027-01-01', end: '2027-01-31' })
  })
})

describe('reporting window', () => {
  it('is open the 1st to the 14th', () => {
    expect(isReportingWindow(new Date(2026, 7, 1))).toBe(true)
    expect(isReportingWindow(new Date(2026, 7, 14))).toBe(true)
    expect(isReportingWindow(new Date(2026, 7, 15))).toBe(false)
  })

  it('counts the days left to file', () => {
    expect(daysUntilDeadline(new Date(2026, 7, 1))).toBe(13)
    expect(daysUntilDeadline(new Date(2026, 7, 14))).toBe(0)
    expect(daysUntilDeadline(new Date(2026, 7, 20))).toBe(0)
  })
})

describe('reportPeriod', () => {
  it('defaults to LAST month while the report window is open', () => {
    expect(reportPeriod(new Date(2026, 7, 3))).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    })
  })

  it('defaults to this month once the window has closed', () => {
    expect(reportPeriod(new Date(2026, 7, 20))).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    })
  })

  it('reaches back into the previous year in January', () => {
    expect(reportPeriod(new Date(2026, 0, 5))).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    })
  })
})
