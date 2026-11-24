// VANTRIK e2e on its own port so it can run next to the other stores' agents.
import base from './playwright.config.js';
export default {
  ...base,
  testMatch: /\/vantrik[^/]*\.spec\.js$/,
  use: { ...base.use, baseURL: 'http://localhost:4184' },
  webServer: { command: 'npx vite build && npx vite preview --port 4184 --strictPort', port: 4184, reuseExistingServer: true, timeout: 180000 },
};
