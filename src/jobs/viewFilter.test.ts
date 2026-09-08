import { describe, expect, it } from 'vitest'
import { applyJobFilters, NO_VIEW_FILTER } from './viewFilter'
import type { Job } from '../model/types'

function job(partial: Partial<Job>): Job {
  return {
    id: '1',
    title: 'Diskare',
    employer: 'Krogen AB',
    municipality: 'Göteborg',
    employmentType: 'heltid',
    applicationChannel: { kind: 'url', value: 'https://a.se' },
    taxonomy: {},
    source: 'platsbanken',
    publishedAt: '2026-09-01',
    url: 'https://example.se/1',
    ...partial,
  }
}

const email = job({
  id: 'email',
  applicationChannel: { kind: 'email', value: 'x@y.se' },
})
const callable = job({
  id: 'callable',
  contact: { name: 'Anna', title: 'Chef', telephone: '070-1234567' },
})
const support = job({ id: 'support', supportMentions: ['nystartsjobb'] })
const everything = job({
  id: 'everything',
  applicationChannel: { kind: 'email', value: 'x@y.se' },
  contact: { name: 'Bo', title: '', telephone: '070-7654321' },
  supportMentions: ['lonebidrag'],
})
const plain = job({ id: 'plain' })
const all = [email, callable, support, everything, plain]

describe('applyJobFilters', () => {
  it('no filter shows everything, order untouched', () => {
    expect(applyJobFilters(all, NO_VIEW_FILTER)).toEqual(all)
  })

  it('each filter works alone', () => {
    expect(
      applyJobFilters(all, { ...NO_VIEW_FILTER, simpleOnly: true }).map((j) => j.id),
    ).toEqual(['email', 'everything'])
    expect(
      applyJobFilters(all, { ...NO_VIEW_FILTER, callableOnly: true }).map((j) => j.id),
    ).toEqual(['callable', 'everything'])
    expect(
      applyJobFilters(all, { ...NO_VIEW_FILTER, supportOnly: true }).map((j) => j.id),
    ).toEqual(['support', 'everything'])
  })

  it('filters combine with AND', () => {
    expect(
      applyJobFilters(all, { simpleOnly: true, callableOnly: true, supportOnly: true }).map(
        (j) => j.id,
      ),
    ).toEqual(['everything'])
  })
})
