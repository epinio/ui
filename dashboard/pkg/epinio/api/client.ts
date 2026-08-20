import epinioAuth, { EpinioAuthTypes } from '../utils/auth';

export interface EpinioClusterContext {
  id: string;
  api: string; // e.g. https://epinio.example.com
  createAuthConfig: (type: EpinioAuthTypes) => any;
}

export class EpinioApiError extends Error {
  status?: number;
  data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function buildQueryString(params: object): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    // skip undefined/null so you don't get ?page=undefined in the URL
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }

  const str = search.toString();
  return str ? `?${str}` : '';
}

function readCookie(name: string): string | undefined {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : undefined;
}

export function createEpinioClient(cluster: EpinioClusterContext, isExtension: boolean = false) {
  async function request(path: string,  opts: RequestInit & { params?: object } = {}) {
    const { params, ...fetchOpts } = opts;

    const query = params ? buildQueryString(params) : '';

    const authHeader = await epinioAuth.authHeader(
      cluster.createAuthConfig(EpinioAuthTypes.AGNOSTIC)
    );

    const csrfToken = readCookie('CSRF');
    const isMutating = opts.method && opts.method !== 'GET' && opts.method !== 'HEAD';

    const res = await fetch(`${isExtension ? cluster.api : `/pp/v1/direct/r/${cluster.id}`}${path}${query}`, {
      ...fetchOpts,
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(isMutating && csrfToken ? { 'X-Api-Csrf': `${csrfToken}=` } : {}),
        ...fetchOpts.headers,
      },
    });

    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('epinio:unauthorized', { detail: { clusterId: cluster.id } }));
    }

    const data = res.status === 204 ? null : await res.json().catch(() => null);

    if (!res.ok) {
      const message = data?.errors?.length
        ? data.errors.map((e: any) => e.title).join(', ')
        : data?.message ?? res.statusText;
      throw new EpinioApiError(message, res.status, data);
    }

    return data;
  }

  return {
    get:    (path: string, opts?: RequestInit & { params?: object }) => request(path, { ...opts, method: 'GET' }),
    post:   (path: string, body?: unknown, opts?: RequestInit & { params?: object }) => request(path, { ...opts, method: 'POST', body: JSON.stringify(body) }),
    put:    (path: string, body?: unknown, opts?: RequestInit & { params?: object }) => request(path, { ...opts, method: 'PUT', body: JSON.stringify(body) }),
    patch:  (path: string, body?: unknown, opts?: RequestInit & { params?: object }) => request(path, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),
    delete: (path: string, body?: unknown, opts?: RequestInit & { params?: object }) => request(path, { ...opts, method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),  };
}