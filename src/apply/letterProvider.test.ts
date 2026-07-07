import { describe, expect, it } from 'vitest'
import { chooseProvider } from './letterProvider'

describe('chooseProvider', () => {
  it('uses Anthropic only when a non-empty key is present', () => {
    expect(chooseProvider('sk-ant-123')).toBe('anthropic')
    expect(chooseProvider('')).toBe('deterministic')
    expect(chooseProvider('   ')).toBe('deterministic')
    expect(chooseProvider(null)).toBe('deterministic')
    expect(chooseProvider(undefined)).toBe('deterministic')
  })
})
