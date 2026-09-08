import { describe, expect, it } from 'vitest'
import { filterCallable, isCallable, telHref } from './callable'
import type { Job } from '../model/types'

function job(partial: Partial<Job>): Job {
  return {
    id: '1',
    title: 'Lokalvårdare',
    employer: 'Ren AB',
    municipality: 'Malmö',
    employmentType: 'deltid',
    applicationChannel: { kind: 'email', value: 'jobb@ren.se' },
    taxonomy: {},
    source: 'platsbanken',
    publishedAt: '2026-09-01',
    url: 'https://example.se/1',
    ...partial,
  }
}

describe('isCallable / filterCallable', () => {
  it('requires a contact with a non-blank telephone', () => {
    expect(isCallable(job({}))).toBe(false)
    expect(isCallable(job({ contact: { name: 'Anna', title: '', telephone: '  ' } }))).toBe(false)
    expect(
      isCallable(job({ contact: { name: 'Anna', title: 'Chef', telephone: '070-123 45 67' } })),
    ).toBe(true)
  })

  it('keeps only callable jobs', () => {
    const list = [
      job({ id: 'a' }),
      job({ id: 'b', contact: { name: '', title: '', telephone: '0701234567' } }),
    ]
    expect(filterCallable(list).map((j) => j.id)).toEqual(['b'])
  })
})

describe('telHref', () => {
  it('strips spaces and dashes', () => {
    expect(telHref('070-123 45 67')).toBe('tel:0701234567')
  })

  it('keeps a leading + for international numbers', () => {
    expect(telHref('+46 70 123 45 67')).toBe('tel:+46701234567')
  })

  it('drops the national (0) after a country code — +46070 dials wrong', () => {
    expect(telHref('+46 (0)70-123 45 67')).toBe('tel:+46701234567')
  })

  it('returns empty for a number-free string, so the UI can skip the link', () => {
    expect(telHref('')).toBe('')
    expect(telHref('ring växeln')).toBe('')
  })
})
