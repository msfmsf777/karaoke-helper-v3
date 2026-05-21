import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import App from './App.tsx'
import OverlayWindow from './components/OverlayWindow.tsx'
import './index.css'
import i18n from './i18n'

import SetlistOverlayWindow from './components/SetlistOverlayWindow.tsx'

import MiniPlayerWindow from './components/MiniPlayer/MiniPlayerWindow';

const path = window.location.pathname;
const hash = window.location.hash;

console.log('[Main] Routing Check:', { path, hash });

const isSetlist = path === '/setlist' || path.startsWith('/obs/setlist') || hash.includes('/setlist');
const isLyrics = path === '/lyrics' || path.startsWith('/obs/lyrics') || path === '/overlay' || hash.includes('/overlay');

const isMiniPlayer = hash.includes('mini-player');

// Priority: Setlist > Lyrics default
const isOverlay = isSetlist || isLyrics;

if (isOverlay || isMiniPlayer) {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  document.body.style.backgroundColor = 'transparent';
  document.body.style.overflow = 'hidden';

  const root = document.getElementById('root');
  if (root) {
    root.style.background = 'transparent';
    root.style.backgroundColor = 'transparent';
  }
}

let ComponentToRender: React.ComponentType = App;
if (isSetlist) ComponentToRender = SetlistOverlayWindow;
else if (isOverlay) ComponentToRender = OverlayWindow;
else if (isMiniPlayer) {
  console.log('[Main] Rendering MiniPlayerWindow');
  ComponentToRender = MiniPlayerWindow;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <React.Suspense fallback={null}>
        <ComponentToRender />
      </React.Suspense>
    </I18nextProvider>
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer?.on?.('main-process-message', (_event, message) => {
  console.log(message)
})
