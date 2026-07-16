import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Single-page app with one main bundle — 741 kB is expected here, not a
    // sign of a problem. Raise the threshold instead of chasing a warning
    // for a size we've already accounted for.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    // 'node' is enough for every test in this project so far — none of them
    // need a real DOM (appConfig.test.ts is pure functions, cloudSync.test.ts
    // polyfills the tiny bit of localStorage it needs itself). Switch to
    // 'jsdom' only if a future test actually needs to render a component.
    environment: 'node',
  },
})