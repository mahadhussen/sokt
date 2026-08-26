// Binary CV storage. A PDF is too large for localStorage (~5MB cap), so the
// CV lives in IndexedDB, keyed per account. The model (profile, applications)
// stays in localStorage; Profile.cvFileRef marks that a CV exists.
//
// Stored as ArrayBuffer bytes, not a Blob: iOS Safari refuses to structured-
// clone a File/Blob into IndexedDB. See cvBytes.ts.

import { fromCvRecord, toCvRecord } from './cvBytes'
import type { CvMeta, CvRecord, StoredCv } from './cvBytes'

export type { CvMeta, StoredCv }

export interface FileStore {
  saveCv(cv: StoredCv): Promise<void>
  loadCv(): Promise<StoredCv | null>
  clearCv(): Promise<void>
}

export const CV_REF = 'cv'

const DB_NAME = 'sokt'
const STORE_NAME = 'files'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Base64 so a CV can travel inside the JSON backup. Chunked: spreading a
// multi-megabyte Uint8Array into String.fromCharCode overflows the stack.
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64ToBlob(base64: string, type = 'application/pdf'): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

// Samma kontoavgränsning som modellen: CV:t nyckelas per konto så att en
// delad dator aldrig visar fel persons CV. null = enhetens okopplade utrymme.
export function createIndexedDbFileStore(userId?: string | null): FileStore {
  const key = userId ? `cv.u.${userId}` : CV_REF
  return {
    async saveCv(cv) {
      // Convert to ArrayBuffer bytes before the transaction — a Blob would
      // throw on iOS. The whole record must be clonable.
      const record = await toCvRecord(cv)
      const db = await openDb()
      await tx(db, 'readwrite', (store) => store.put(record, key))
      db.close()
    },
    async loadCv() {
      const db = await openDb()
      const result = await tx<CvRecord | undefined>(db, 'readonly', (store) => store.get(key))
      db.close()
      return result ? fromCvRecord(result) : null
    },
    async clearCv() {
      const db = await openDb()
      await tx(db, 'readwrite', (store) => store.delete(key))
      db.close()
    },
  }
}
