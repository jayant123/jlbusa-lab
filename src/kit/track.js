// GA4 events, no personal data. No-op when gtag isn't loaded.
export function track(event, params = {}) {
  try { if (typeof window.gtag === 'function') window.gtag('event', event, params); } catch { /* ignore */ }
}
