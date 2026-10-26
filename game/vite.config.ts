import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Stock config (assembly brief §3.5): react plugin only. Workers bundle
// natively via the canon `new URL('../workers/*.ts', import.meta.url)`
// pattern — src/render/ and src/workers/ must stay siblings.
export default defineConfig({
  plugins: [react()],
})
