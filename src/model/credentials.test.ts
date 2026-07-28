import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, isCompleteCode, isValidEmail, normalizeCode, normalizeEmail } from './credentials'

describe('normalizeEmail', () => {
  it('trims and lowercases, because phone keyboards capitalise', () => {
    expect(normalizeEmail('  Amina.Yusuf@Example.SE ')).toBe('amina.yusuf@example.se')
  })
})

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('amina@example.se')).toBe(true)
    expect(isValidEmail('mahad+sokt@arbetsklivet.se')).toBe(true)
    expect(isValidEmail(' Amina@Example.SE ')).toBe(true)
  })

  it('rejects what cannot receive mail', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('amina')).toBe(false)
    expect(isValidEmail('amina@')).toBe(false)
    expect(isValidEmail('@example.se')).toBe(false)
    expect(isValidEmail('amina@example')).toBe(false)
    expect(isValidEmail('amina@@example.se')).toBe(false)
    expect(isValidEmail('amina @example.se')).toBe(false)
    expect(isValidEmail('amina@.se')).toBe(false)
    expect(isValidEmail('amina@example.')).toBe(false)
  })
})

describe('normalizeCode', () => {
  it('keeps the digits and drops everything else', () => {
    expect(normalizeCode('123456')).toBe('123456')
    expect(normalizeCode(' 123 456 ')).toBe('123456')
    expect(normalizeCode('123-456')).toBe('123456')
    // Non-breaking space, as pasted out of some mail clients.
    expect(normalizeCode('123 456')).toBe('123456')
  })

  it('never exceeds the code length', () => {
    expect(normalizeCode('12345678')).toBe('123456')
    expect(normalizeCode('123456').length).toBe(CODE_LENGTH)
  })

  it('is empty for input with no digits', () => {
    expect(normalizeCode('koden')).toBe('')
    expect(normalizeCode('')).toBe('')
  })
})

describe('isCompleteCode', () => {
  it('is true only at full length', () => {
    expect(isCompleteCode('12345')).toBe(false)
    expect(isCompleteCode('123456')).toBe(true)
    expect(isCompleteCode('12 34 56')).toBe(true)
    expect(isCompleteCode('')).toBe(false)
  })
})
