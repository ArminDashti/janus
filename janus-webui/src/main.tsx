import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { agentManagerClient, connectScanEvents } from '@renderer/api/client'
import App from './App'
import './index.css'

registerSW({ immediate: true })

window.agentManager = agentManagerClient
connectScanEvents()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
