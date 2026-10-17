# Even Reality G2 — LA Hacks 2026 Template

A hackathon-ready template for building Even Reality G2 smart glasses apps with a backend API server.

## Architecture

```
┌──────────────┐   HTTP/JSON    ┌──────────────────┐
│  Express     │ ◄────────────► │  Vite + TS       │
│  Backend     │                │  (phone WebView) │
│  (laptop)    │                │                  │
└──────────────┘                └────────┬─────────┘
                                         │ SDK Bridge
                                         ▼
                                ┌──────────────────┐
                                │  Even G2 Glasses  │
                                │  576×288 mono     │
                                └──────────────────┘
```

**Frontend** (`src/`): Vite + TypeScript app running in the phone's WebView. Uses the Even Hub SDK to render UI on the glasses and handle input events.

**Backend** (`server/`): Express API server running on your laptop. Handles API keys, external service calls (OpenAI, etc.), and any server-side logic.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env with your API keys and your laptop's LAN IP
```

### 3. Run development servers
```bash
# Both frontend + backend together:
npm run dev:all

# Or separately:
npm run dev          # Frontend (Vite) on :5173
npm run dev:backend  # Backend (Express) on :3001
```

### 4. Test on the simulator
```bash
npm run sim
# Then open the URL shown in your browser
```

### 5. Test on real G2 glasses
1. Get your laptop's LAN IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
2. Generate a QR code pointing to `http://<your-ip>:5173`
3. Scan the QR in the Even Realities phone app → Scan QR
4. Your app should render on the G2!

### 6. Package for submission
```bash
npm run package
# Creates an .ehpk file in the project root
# Upload it to the EvenHub developer portal
```

## Project Structure

```
├── src/
│   ├── main.ts         ← Entry point
│   ├── app.ts          ← Main app logic (START HERE)
│   ├── display.ts      ← G2 display wrapper
│   ├── events.ts       ← G2 input event handler
│   ├── api.ts          ← Backend API client
│   ├── state.ts        ← State management
│   └── vite-env.d.ts   ← TypeScript env types
├── server/
│   └── index.ts        ← Express backend server
├── public/
│   └── icon.png        ← App icon (24×24 greyscale)
├── app.json            ← Even Hub manifest
├── index.html          ← Vite HTML entry
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tsconfig.server.json
```

## G2 Display Specs

- **Resolution**: 576 × 288 pixels per eye
- **Color**: Monochrome green (no RGB)
- **No camera, no speaker**
- **Input**: Temple touchpad (tap, double-tap, long press, swipe forward/backward)
- **Microphone**: Available for voice input

## Key SDK Concepts

| Concept | Description |
|---------|-------------|
| `waitForEvenAppBridge()` | **Always** await this first before any SDK call |
| `TextContainerProperty` | Renders text on the glasses display |
| `ImageContainerProperty` | Renders greyscale images |
| `isEventCapture: 1` | Required on containers that need to receive tap events |
| `createStartUpPageContainer` | Renders the initial (root) page |
| `createPageContainer` | Navigates to a new page |
| `textContainerUpgrade` | Updates text in-place without full re-render |
| `shutDownPageContainer(1)` | Shows exit dialog (required on root page double-tap) |
| `onEvenHubEvent` | Receives all input events from the glasses |

## Input Events

| Event | G2 Gesture |
|-------|-----------|
| `CLICK_EVENT` | Single tap |
| `DOUBLE_CLICK_EVENT` | Double tap |
| `LONG_PRESS_EVENT` | Long press |
| `SLIDE_FORWARD_EVENT` | Swipe forward |
| `SLIDE_BACKWARD_EVENT` | Swipe backward |

## Adding API Integrations

1. Add your API key to `.env`
2. Add the domain to `app.json` → `network` array
3. Create your endpoint in `server/index.ts`
4. Call it from the frontend via `src/api.ts`

## Useful Commands

```bash
npm run dev          # Start Vite dev server
npm run dev:backend  # Start Express backend
npm run dev:all      # Start both
npm run build        # Build for production
npm run package      # Build + create .ehpk
npm run sim          # Launch the Even simulator
```

## Important Notes

- **Use LAN IP, not localhost**: The phone WebView can't reach `localhost` on your laptop. Use your LAN IP (e.g., `192.168.x.x`).
- **CORS matters**: The `app.json` network whitelist doesn't bypass CORS. Your backend must send proper CORS headers.
- **Double-tap exit**: The root page must show the system exit dialog on double-tap. This is required for QA.
- **Keep text short**: The 576×288 display is small. Keep messages brief.

## Resources

- [Even Hub Docs](https://hub.evenrealities.com/docs/get-started/overview)
- [SDK Package](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [Template Repo](https://github.com/even-realities/evenhub-templates)
- [LA Hacks Challenge](https://evenrealities-lahacks.vercel.app/)
- [Discord](https://discord.gg/Y4jHMCU4sv)
