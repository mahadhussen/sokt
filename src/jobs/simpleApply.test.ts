import { describe, expect, it } from 'vitest'
import type { Job } from '../model/types'
import { filterSimpleApply, isSimpleApply } from './simpleApply'

function job(kind: Job['applicationChannel']['kind'], id = '1'): Job {
  return {
    id,
    title: 'Lokalvårdare',
    employer: 'Städ AB',
    municipality: 'Uppsala',
    employmentType: 'heltid',
    applicationChannel: kind === 'unknown' ? { kind } : { kind, value: 'x' },
    taxonomy: {},
    source: 'platsbanken',
    publishedAt: '2026-07-06',
    url: 'https://example.com',
  }
}

describe('isSimpleApply', () => {
  it('is true only for the email channel', () => {
    expect(isSimpleApply(job('email'))).toBe(true)
    expect(isSimpleApply(job('url'))).toBe(false)
    expect(isSimpleApply(job('unknown'))).toBe(false)
  })
})

describe('filterSimpleApply', () => {
  it('keeps only email-apply jobs, preserving order', () => {
    const jobs = [job('url', 'a'), job('email', 'b'), job('unknown', 'c'), job('email', 'd')]
    expect(filterSimpleApply(jobs).map((j) => j.id)).toEqual(['b', 'd'])
  })
})
