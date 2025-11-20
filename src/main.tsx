import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import OverlayWindow from './components/OverlayWindow.tsx'
import './index.css'

const isOverlay = window.location.hash === '#/overlay';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isOverlay ? <OverlayWindow /> : <App />}
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
