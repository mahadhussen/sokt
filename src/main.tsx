import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Efter en deploy pekar en redan öppen flik på gamla chunk-namn som inte längre
// finns på servern — en dynamisk import (t.ex. CV-parsern) ger då 404 och ett
// rött fel mitt i ansiktet på deltagaren. Ladda om EN gång så hämtas nya HTML:en
// med rätt chunk-namn. Tidsstämpelvakten hindrar en omladdningsloop om felet
// beror på något annat än en inaktuell deploy (då får det riktiga felet synas).
window.addEventListener('vite:preloadError', (event) => {
  const last = Number(sessionStorage.getItem('sokt.chunkReloadAt') || 0)
  if (Date.now() - last < 10_000) return
  event.preventDefault()
  sessionStorage.setItem('sokt.chunkReloadAt', String(Date.now()))
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
