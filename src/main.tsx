import React, { lazy } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import OverlayWindow from './components/OverlayWindow.tsx'
import './index.css'

import SetlistOverlayWindow from './components/SetlistOverlayWindow.tsx'

const path = window.location.pathname;
const hash = window.location.hash;

console.log('[Main] Routing Check:', { path, hash });

const isSetlist = path === '/setlist' || path.startsWith('/obs/setlist') || hash.includes('/setlist');
const isLyrics = path === '/lyrics' || path.startsWith('/obs/lyrics') || path === '/overlay' || hash.includes('/overlay');

const isMiniPlayer = hash.includes('/mini-player');

// Priority: Setlist > Lyrics default
const isOverlay = isSetlist || isLyrics;

if (isOverlay || isMiniPlayer) {
  document.body.style.backgroundColor = 'transparent';
}

let ComponentToRender: React.ComponentType = App;
if (isSetlist) ComponentToRender = SetlistOverlayWindow;
else if (isOverlay) ComponentToRender = OverlayWindow;
else if (isMiniPlayer) ComponentToRender = lazy(() => import('./components/MiniPlayer/MiniPlayerWindow'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ComponentToRender />
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
