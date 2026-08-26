import { describe, expect, it } from 'vitest'
import { fromCvRecord, toCvRecord } from './cvBytes'
import type { CvRecord, StoredCv } from './cvBytes'

const stored = (over: Partial<StoredCv> = {}): StoredCv => ({
  fileName: 'CV.pdf',
  text: 'Amina Yusuf',
  byteSize: 4,
  blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/pdf' }),
  ...over,
})

describe('toCvRecord', () => {
  it('lagrar som ArrayBuffer, inte Blob (iOS-säkert)', async () => {
    const rec = await toCvRecord(stored())
    expect(rec.bytes).toBeInstanceOf(ArrayBuffer)
    expect(rec.blob).toBeUndefined()
    expect(rec.mimeType).toBe('application/pdf')
    expect(new Uint8Array(rec.bytes!)).toEqual(new Uint8Array([1, 2, 3, 4]))
  })

  it('faller tillbaka till application/pdf när blob saknar typ', async () => {
    const rec = await toCvRecord(stored({ blob: new Blob([new Uint8Array([9])]) }))
    expect(rec.mimeType).toBe('application/pdf')
  })

  it('rundtur: bytes tillbaka till en likvärdig blob', async () => {
    const rec = await toCvRecord(stored())
    const back = fromCvRecord(rec)
    expect(back.fileName).toBe('CV.pdf')
    expect(back.blob.type).toBe('application/pdf')
    expect(new Uint8Array(await back.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]))
  })
})

describe('fromCvRecord', () => {
  it('läser en gammal post som har blob i stället för bytes', () => {
    const legacy: CvRecord = {
      fileName: 'gammal.pdf',
      text: '',
      byteSize: 2,
      mimeType: 'application/pdf',
      blob: new Blob([new Uint8Array([7, 8])], { type: 'application/pdf' }),
    }
    const back = fromCvRecord(legacy)
    expect(back.fileName).toBe('gammal.pdf')
    expect(back.blob).toBe(legacy.blob)
  })
})
