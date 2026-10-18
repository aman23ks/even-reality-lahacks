/**
 * main.ts — AuraPet G2 App Entry Point
 * 
 * Boots:
 *   1. Even Reality G2 Smart Glasses Bridge Controller (AuraPetApp)
 *   2. Mobile WebView & Browser Companion Dashboard (renderCompanionDashboard)
 */

import { AuraPetApp } from './app'
import { renderCompanionDashboard } from './companion/ui'

const app = new AuraPetApp()

// Render the mobile companion dashboard immediately
renderCompanionDashboard(app)

// Start the G2 SDK bridge and continuous voice listening
app.start().catch((err) => {
  console.warn('[main] App start error (running in local simulation mode):', err)
})
