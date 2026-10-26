import { defineConfig } from 'playwright/test'

// Assembly brief §3.7. Chrome channel is REQUIRED (WebGL2 for 1F's A/B
// renders, performance.memory for heap rows, IndexedDB for 1G). Serial
// workers: GPU and Web Worker harnesses do not parallelize safely.
export default defineConfig({
  testDir: 'e2e',
  timeout: 300_000,
  workers: 1,
  use: {
    channel: 'chrome',
    headless: true,
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
