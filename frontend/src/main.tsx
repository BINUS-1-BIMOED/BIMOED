import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Service worker is automatically registered by vite-plugin-pwa (see vite.config.ts)
// The custom service-worker.ts is injected via VitePWA's injectManifest or custom SW strategy

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
