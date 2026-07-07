import { describe, expect, it } from 'vitest'
import type { Profile } from '../model/types'
import { applicantFields } from './applicantFields'

const base: Profile = {
  id: 'p1',
  firstName: 'Amina',
  lastName: 'Hassan',
  email: 'amina@example.com',
  baseLetter: '',
  details: { telefon: '0701234567', adress: 'Storgatan 1', ort: 'Uppsala', fodelsear: '1995' },
}

describe('applicantFields', () => {
  it('returns name, contact, address and birth year in order', () => {
    expect(applicantFields(base).map((f) => f.key)).toEqual([
      'firstName',
      'lastName',
      'email',
      'phone',
      'address',
      'city',
      'birthYear',
    ])
    expect(applicantFields(base).map((f) => f.value)).toEqual([
      'Amina',
      'Hassan',
      'amina@example.com',
      '0701234567',
      'Storgatan 1',
      'Uppsala',
      '1995',
    ])
  })

  it('drops fields the user has not filled in', () => {
    const sparse: Profile = { ...base, details: { telefon: '0700000000' } }
    expect(applicantFields(sparse).map((f) => f.key)).toEqual([
      'firstName',
      'lastName',
      'email',
      'phone',
    ])
  })
})
