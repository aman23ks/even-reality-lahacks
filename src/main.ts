/**
 * main.ts — Even Reality G2 App Entry Point
 * 
 * This is the main entry point that runs in the phone's WebView.
 * It initializes the SDK bridge, sets up the display, and handles
 * all input events from the G2 glasses.
 * 
 * Architecture:
 *   Your code here (WebView) → SDK Bridge → Even App → Bluetooth → G2 Glasses
 *   G2 input events travel the reverse path back to your onEvenHubEvent callback.
 */

import { EvenG2App } from './app'

// Boot the app
const app = new EvenG2App()
app.start().catch(console.error)
