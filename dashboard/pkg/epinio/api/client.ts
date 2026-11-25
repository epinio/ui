import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import { isSameOriginEpinioApi } from '../utils/standalone-api';

export interface EpinioClusterContext {
  id: string;
  api: string; // e.g. https://epinio.example.com
  createAuthConfig: (type: EpinioAuthTypes) => any;
}

type EpinioRequestOpts = RequestInit & {
    params?:       object;
    responseType?: 'json' | 'blob' | 'text';
    signal?:       AbortSignal;
};

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
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (body instanceof FormData) return body;
  return JSON.stringify(body);
}

function headersFor(body: unknown, extra?: HeadersInit): HeadersInit {
  // Let fetch set content-type automatically for FormData (includes boundary)
  if (body instanceof FormData) return extra ?? {};
  return { 'content-type': 'application/json', ...extra };
}

function requestBase(cluster: EpinioClusterContext, isExtension: boolean, sameOriginEpinio: boolean): string {
  if (isExtension) {
    return cluster.api.replace(/\/$/, '');
  }

  // Production ingress: same-origin /api. Local Jetstream: proxy path.
  if (sameOriginEpinio) {
    return '';
  }

  return `/pp/v1/direct/r/${ cluster.id }`;
}

export function createEpinioClient(cluster: EpinioClusterContext, isExtension: boolean = false) {
  async function request(path: string,  opts: EpinioRequestOpts = {}) {
    const { params, signal, ...fetchOpts } = opts;

    const query = params ? buildQueryString(params) : '';

    const authHeader = await epinioAuth.authHeader(
      cluster.createAuthConfig(EpinioAuthTypes.AGNOSTIC)
    );

    const isMutating = opts.method && opts.method !== 'GET' && opts.method !== 'HEAD';
    const sameOriginEpinio = !isExtension && await isSameOriginEpinioApi();
    // Same-origin / extension → Epinio EPINIO_CSRF (historical "=" quirk).
    // Local Jetstream `/pp/v1/direct/r/...` → Jetstream CSRF cookie as X-Xsrf-Token
    // (exact match; do not send EPINIO_CSRF — plugin would overwrite X-Xsrf-Token).
    const csrfHeaders: Record<string, string> = {};

    if (isMutating) {
      if (isExtension || sameOriginEpinio) {
        const epinioCsrf = readCookie('EPINIO_CSRF');

        if (epinioCsrf) {
          csrfHeaders['X-Api-Csrf'] = `${ epinioCsrf }=`;
        }
      } else {
        const jetstreamCsrf = readCookie('CSRF') || readCookie('XSRF-TOKEN');

        if (jetstreamCsrf) {
          csrfHeaders['X-Xsrf-Token'] = jetstreamCsrf;
        }
      }
    }

    const res = await fetch(`${requestBase(cluster, isExtension, sameOriginEpinio)}${path}${query}`, {
      ...fetchOpts,
      credentials: 'include',
      signal,
      headers: {
        ...headersFor(fetchOpts.body),
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...csrfHeaders,
        ...fetchOpts.headers,
      },
    });

    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('epinio:unauthorized', { detail: { clusterId: cluster.id } }));
    }

    let data = null;
    if (res.status !== 204) {
      if (opts.responseType === 'blob') {
        data = await res.blob().catch(() => null);
      } else if (opts.responseType === 'text') {
        data = await res.text().catch(() => null);
      } else {
        data = await res.json().catch(() => null);
      }
    }

    if (!res.ok) {
      const message = data?.errors?.length
        ? data.errors.map((e: any) => e.title).join(', ')
        : data?.message ?? res.statusText;
      throw new EpinioApiError(message, res.status, data);
    }

    return data;
  }

  return {
    get:    (path: string, opts?: EpinioRequestOpts) => request(path, { ...opts, method: 'GET' }),
    post:   (path: string, body?: unknown, opts?: EpinioRequestOpts) => request(path, { ...opts, method: 'POST', body: serializeBody(body) }),
    put:    (path: string, body?: unknown, opts?: EpinioRequestOpts) => request(path, { ...opts, method: 'PUT', body: serializeBody(body) }),
    patch:  (path: string, body?: unknown, opts?: EpinioRequestOpts) => request(path, { ...opts, method: 'PATCH', body: serializeBody(body) }),
    delete: (path: string, body?: unknown, opts?: EpinioRequestOpts) => request(path, { ...opts, method: 'DELETE', body: serializeBody(body) }),
  };
}
