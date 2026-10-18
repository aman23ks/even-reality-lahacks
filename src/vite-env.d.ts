/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployed backend, baked in by `npm run package:prod <url>` (unset in dev) */
  readonly VITE_BACKEND_URL?: string
  /** Shared key matching the server's APP_KEY (unset in dev) */
  readonly VITE_APP_KEY?: string
  /** '1' = fresh installs start in judge mode */
  readonly VITE_JUDGE_DEFAULT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
