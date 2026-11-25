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

    if (!res.ok) {
      cached = false;

      return false;
    }

    const data = await res.json().catch(() => null);

    // Epinio Info response includes version / oidc_enabled; Jetstream info looks different.
    cached = !!(data && (typeof data.version === 'string' || typeof data.oidc_enabled === 'boolean'));

    return cached;
  } catch {
    cached = false;

    return false;
  }
}

/** Test helper — reset cache between unit tests. */
export function resetSameOriginEpinioApiCache() {
  cached = null;
}
