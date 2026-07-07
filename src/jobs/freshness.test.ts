import { describe, expect, it } from 'vitest'
import { minutesAgo } from './freshness'

describe('minutesAgo', () => {
  it('returns whole minutes elapsed', () => {
    const now = 1_000 * 60 * 100 // 100 minutes in ms
    expect(minutesAgo(now, now)).toBe(0)
    expect(minutesAgo(now - 60_000, now)).toBe(1)
    expect(minutesAgo(now - 90_000, now)).toBe(1)
    expect(minutesAgo(now - 60_000 * 150, now)).toBe(150)
  })

  it('never goes negative for a future timestamp', () => {
    expect(minutesAgo(1000, 0)).toBe(0)
  })
})
