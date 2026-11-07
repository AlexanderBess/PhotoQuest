declare global {
  interface ImportMetaEnv {
    readonly VITE_ROBOTS_NOINDEX?: string
  }
}

/** Build-time settings. Never put secrets in VITE_* variables: they end up in the client bundle. */
export const env = {
  robotsNoindex: import.meta.env.VITE_ROBOTS_NOINDEX === 'true',
} as const
