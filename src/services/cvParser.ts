// Extracts plain text from an uploaded CV (PDF) with pdfjs-dist (Apache-2.0).
// The text is stored for reuse (e.g. future letter tailoring) and never sent
// anywhere. Parsing is best effort — a scanned image PDF yields empty text,
// which is fine; the CV file itself is still stored and attachable.

import * as pdfjs from 'pdfjs-dist'
// Vite resolves the worker URL at build time.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export async function extractPdfText(file: File | Blob): Promise<string> {
  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const parts: string[] = []
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    parts.push(line)
  }
  await doc.destroy()
  return parts.join('\n').replace(/[ \t]+/g, ' ').trim()
}
