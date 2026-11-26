/**
 * Detect whether same-origin `/api` is the real Epinio server (production ingress)
 * or Jetstream/Stratos (local `yarn dev` + `./jetstream`).
 *
 * Local: `/api/v1/info` → 401 "Stratos admin" → use Jetstream `/pp/v1/direct/r/...` proxy.
 * Prod:  `/api/v1/info` → 200 with Epinio shape → talk same-origin with session cookies.
 */

let cached: boolean | null = null;

export async function isSameOriginEpinioApi(): Promise<boolean> {
  if (cached !== null) {
    return cached;
  }

  try {
    const res = await fetch('/api/v1/info', { credentials: 'include' });

    if (res.ok) {
      const data = await res.json().catch(() => null);

      // Epinio Info response includes version / oidc_enabled; Jetstream info looks different.
      cached = !!(data && (typeof data.version === 'string' || typeof data.oidc_enabled === 'boolean'));

      return cached;
    }

    // Definitive "not Epinio" (Jetstream returns 401 on /api/v1/info).
    if (res.status === 401) {
      cached = false;

      return false;
    }

    // Other status codes: do not cache — may be transient.
    return false;
  } catch {
    // Network blip: do not cache failure for the page lifetime.
    return false;
  }
}

/** Test helper — reset cache between unit tests. */
export function resetSameOriginEpinioApiCache() {
  cached = null;
}
