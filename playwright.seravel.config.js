// SERAVEL tests on their own port so parallel store builds do not share a server.
import base from './playwright.config.js';
export default { ...base, testMatch: /seravel.*\.spec\.js/, use: { ...base.use, baseURL: 'http://localhost:4183' },
  webServer: { command: 'npm run build && npx vite preview --port 4183 --strictPort', port: 4183, reuseExistingServer: false, timeout: 180000 } };
