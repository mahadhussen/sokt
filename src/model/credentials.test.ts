import { describe, expect, it } from 'vitest'
import {
  isCompleteCode,
  isValidEmail,
  MAX_CODE_LENGTH,
  MIN_CODE_LENGTH,
  normalizeCode,
  normalizeEmail,
} from './credentials'

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
    expect(normalizeCode('123 456')).toBe('123456')
  })

  it('keeps codes longer than six digits — Supabase OTP length is configurable', () => {
    // The bug this guards: an 8-digit code must not be truncated to a wrong 6.
    expect(normalizeCode('00726512')).toBe('00726512')
    expect(normalizeCode('00 72 65 12')).toBe('00726512')
  })

  it('never exceeds the maximum supported length', () => {
    expect(normalizeCode('1234567890123')).toBe('1234567890')
    expect(normalizeCode('1234567890').length).toBe(MAX_CODE_LENGTH)
  })

  it('is empty for input with no digits', () => {
    expect(normalizeCode('koden')).toBe('')
    expect(normalizeCode('')).toBe('')
  })
})

describe('isCompleteCode', () => {
  it('accepts any code from the minimum length up', () => {
    expect(isCompleteCode('12345')).toBe(false)
    expect(isCompleteCode('123456')).toBe(true)
    expect(isCompleteCode('00726512')).toBe(true) // 8-digit
    expect(isCompleteCode('12 34 56')).toBe(true)
    expect(isCompleteCode('')).toBe(false)
  })

  it('has a sane range', () => {
    expect(MIN_CODE_LENGTH).toBe(6)
    expect(MAX_CODE_LENGTH).toBeGreaterThanOrEqual(MIN_CODE_LENGTH)
  })
})
