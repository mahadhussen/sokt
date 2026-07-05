import { describe, expect, it } from 'vitest'
import { dirFor, translate, uiEmploymentTypeLabel, uiSurveyLabel } from './translations'

describe('translate', () => {
  it('returns the string for the language', () => {
    expect(translate('sv', 'tab.jobb')).toBe('Jobb')
    expect(translate('ar', 'tab.jobb')).toBe('الوظائف')
    expect(translate('so', 'tab.jobb')).toBe('Shaqooyin')
  })

  it('interpolates named params', () => {
    expect(translate('sv', 'results.count', { total: 9, shown: 9 })).toBe(
      '9 annonser hittade, visar 9.',
    )
    expect(translate('so', 'apps.removeAria', { title: 'Diskare' })).toBe(
      'Tirtir codsiga: Diskare',
    )
  })

  it('falls back to Swedish, then the key, for a missing translation', () => {
    // Every key exists in sv, so a truly missing key returns itself.
    expect(translate('ar', 'does.not.exist')).toBe('does.not.exist')
  })
})

describe('dirFor', () => {
  it('is rtl only for Arabic', () => {
    expect(dirFor('ar')).toBe('rtl')
    expect(dirFor('sv')).toBe('ltr')
    expect(dirFor('so')).toBe('ltr')
  })
})

describe('ui labels', () => {
  it('translate employment type and survey for the screen', () => {
    expect(uiEmploymentTypeLabel('sv', 'timanstalld')).toBe('Timanställd')
    expect(uiEmploymentTypeLabel('ar', 'heltid')).toBe('دوام كامل')
    expect(uiSurveyLabel('so', true)).toBe('Haa')
    expect(uiSurveyLabel('so', false)).toBe('Maya')
  })
})
