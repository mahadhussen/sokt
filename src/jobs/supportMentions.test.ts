import { describe, expect, it } from 'vitest'
import {
  filterSupportMentions,
  findSupportMentions,
  mentionsSupport,
  SUPPORT_FORMS,
} from './supportMentions'
import type { Job } from '../model/types'

function job(partial: Partial<Job>): Job {
  return {
    id: '1',
    title: 'Diskare',
    employer: 'Krogen AB',
    municipality: 'Göteborg',
    employmentType: 'heltid',
    applicationChannel: { kind: 'email', value: 'jobb@krogen.se' },
    taxonomy: {},
    source: 'platsbanken',
    publishedAt: '2026-09-01',
    url: 'https://example.se/1',
    ...partial,
  }
}

describe('findSupportMentions', () => {
  it('finds nystartsjobb case-insensitively, as in a real ad', () => {
    // Verbatim from a real Platsbanken ad (2026-09-08).
    const text = 'Om ni har Nystartsjobb, Introduktionsjobb, lönebidrag etc så skriv med det i mailet.'
    expect(findSupportMentions(text)).toEqual(['nystartsjobb', 'introduktionsjobb', 'lonebidrag'])
  })

  it('finds jobb- och utvecklingsgarantin via the garanti stem', () => {
    expect(findSupportMentions('Du som är inskriven i jobb- och utvecklingsgarantin är välkommen')).toEqual([
      'utvecklingsgarantin',
    ])
    expect(findSupportMentions('deltagare i utvecklingsgarantin')).toEqual(['utvecklingsgarantin'])
  })

  it('groups the rare named forms under stod', () => {
    expect(findSupportMentions('Vi tar emot anställningsstöd')).toEqual(['stod'])
    expect(findSupportMentions('möjlighet till etableringsjobb')).toEqual(['stod'])
    expect(findSupportMentions('subventionerad anställning kan diskuteras')).toEqual(['stod'])
  })

  it('does NOT match nystart in nystartat företag (false friend)', () => {
    expect(findSupportMentions('Vi är ett nystartat företag med nystart varje dag')).toEqual([])
  })

  it('does NOT match extratjänst — in ad language it means extra gig, not the stöd', () => {
    // Verbatim from a real ad: "Omfattning: extratjänst på timmar".
    expect(findSupportMentions('Omfattning: extratjänst på timmar, med arbete på helger')).toEqual([])
    expect(SUPPORT_FORMS.flatMap((f) => f.matchers)).not.toContain('extratjänst')
  })

  it('reports each form once even when mentioned twice', () => {
    expect(findSupportMentions('Nystartsjobb! Vi älskar nystartsjobb.')).toEqual(['nystartsjobb'])
  })

  it('returns empty for empty or unrelated text', () => {
    expect(findSupportMentions('')).toEqual([])
    expect(findSupportMentions('Vi söker en glad diskare till vårt kök.')).toEqual([])
  })
})

describe('mentionsSupport / filterSupportMentions', () => {
  it('treats a missing field as no mentions (old cached jobs)', () => {
    expect(mentionsSupport(job({}))).toBe(false)
    expect(mentionsSupport(job({ supportMentions: [] }))).toBe(false)
    expect(mentionsSupport(job({ supportMentions: ['nystartsjobb'] }))).toBe(true)
  })

  it('keeps only jobs with mentions', () => {
    const list = [job({ id: 'a' }), job({ id: 'b', supportMentions: ['lonebidrag'] })]
    expect(filterSupportMentions(list).map((j) => j.id)).toEqual(['b'])
  })
})
