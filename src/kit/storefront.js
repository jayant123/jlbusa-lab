// Shopify Storefront API client for the concept stores (public token, browser-safe).
export class StorefrontError extends Error {
  constructor(message, { status = 0, retryable = false } = {}) {
    super(message);
    this.name = 'StorefrontError';
    this.status = status;
    this.retryable = retryable;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createStorefront({ domain, token, apiVersion = '2025-10', retryDelayMs = 800 }) {
  const url = `https://${domain}/api/${apiVersion}/graphql.json`;

  async function once(gql, variables) {
    let r;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token },
        body: JSON.stringify({ query: gql, variables }),
      });
    } catch (e) {
      throw new StorefrontError(`Network error: ${e.message}`, { retryable: true });
    }
    if (r.status === 429 || r.status >= 500) throw new StorefrontError(`Storefront ${r.status}`, { status: r.status, retryable: true });
    if (!r.ok) throw new StorefrontError(`Storefront ${r.status}`, { status: r.status });
    const body = await r.json();
    if (body.errors?.length) throw new StorefrontError(body.errors.map((e) => e.message).join('; '), { status: r.status });
    return body.data;
  }

  return {
    async query(gql, variables = {}) {
      try {
        return await once(gql, variables);
      } catch (e) {
        if (!e.retryable) throw e;
        await sleep(retryDelayMs);
        return once(gql, variables);
      }
    },
  };
}
