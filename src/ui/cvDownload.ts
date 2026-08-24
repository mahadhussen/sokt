// Download the stored CV blob to the device. Shared by the profile and the
// apply panel so a participant can grab the file to attach to their email
// without leaving the flow they are in.

import { fileStore } from '../app/store'

export async function downloadStoredCv(): Promise<boolean> {
  const stored = await fileStore.loadCv()
  if (!stored) return false
  const url = URL.createObjectURL(stored.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = stored.fileName
  a.click()
  // Give the download a beat to start before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
