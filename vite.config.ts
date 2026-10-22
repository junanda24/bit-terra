import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // src/__audit__ holds the 2026-10-22 audit evidence probes: they pin the
    // PRE-fix behavior, so a handful fail by design after the Tahap A fix
    // wave. Excluded from the standard suite; run them explicitly with
    // `npx vitest run src/__audit__` to inspect the evidence trail.
    exclude: [...configDefaults.exclude, 'src/__audit__/**'],
  },
})

// Fase 1: sql.js wasm dilayani lokal lewat ?url import di sandbox/sql
