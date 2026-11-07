import { fileURLToPath, URL } from 'node:url'

import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const API_ORIGIN = 'http://127.0.0.1:8080'

function resolveFromRoot(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

/** Adds the robots meta tag to the built index.html of flagged (staging) builds. */
function robotsNoindex(enabled: boolean): Plugin {
  return {
    name: 'photoquest:robots-noindex',
    apply: 'build',
    transformIndexHtml() {
      if (!enabled) {
        return []
      }
      return [
        {
          tag: 'meta',
          attrs: { name: 'robots', content: 'noindex, nofollow' },
          injectTo: 'head',
        },
      ]
    },
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv reads .env files and the shell; a variable set in the shell takes precedence.
  const env = loadEnv(mode, resolveFromRoot('.'), 'VITE_')

  return {
    plugins: [
      vue(),
      VueI18nPlugin({
        include: [resolveFromRoot('./src/shared/i18n/locales/**')],
      }),
      robotsNoindex(env.VITE_ROBOTS_NOINDEX === 'true'),
    ],
    resolve: {
      alias: {
        '@': resolveFromRoot('./src'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': API_ORIGIN,
        '/healthz': API_ORIGIN,
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.spec.ts'],
    },
  }
})
