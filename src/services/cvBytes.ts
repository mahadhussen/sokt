// Konvertering mellan lagringsformat och Blob för CV:t. Ren modul: inga imports
// från ui, render, app — testbar utan IndexedDB.
//
// iOS Safari vägrar strukturklona ett File/Blob in i IndexedDB ("Error
// preparing Blob/File data to be stored in object store"). En ArrayBuffer är
// klonbar överallt, så CV:t lagras som bytes + mimetyp och Blob återskapas vid
// läsning.

export interface CvMeta {
  fileName: string
  text: string // extraherad PDF-text (kan vara tom)
  byteSize: number
}

export interface StoredCv extends CvMeta {
  blob: Blob
}

// Det som faktiskt ligger i IndexedDB. Nya poster har `bytes`; äldre poster
// (från före iOS-fixen) kan ha `blob` — läsningen klarar båda.
export interface CvRecord extends CvMeta {
  mimeType: string
  bytes?: ArrayBuffer
  blob?: Blob // legacy — läses men skrivs aldrig
}

export async function toCvRecord(cv: StoredCv): Promise<CvRecord> {
  return {
    fileName: cv.fileName,
    text: cv.text,
    byteSize: cv.byteSize,
    mimeType: cv.blob.type || 'application/pdf',
    bytes: await cv.blob.arrayBuffer(),
  }
}

export function fromCvRecord(rec: CvRecord): StoredCv {
  // Legacy-post med blob (skriven före fixen) — använd den direkt.
  const blob = rec.blob ?? new Blob([rec.bytes ?? new ArrayBuffer(0)], { type: rec.mimeType })
  return { fileName: rec.fileName, text: rec.text, byteSize: rec.byteSize, blob }
}
