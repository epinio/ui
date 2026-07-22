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

export function createEpinioClient(cluster: EpinioClusterContext) {
  async function request(path: string, opts: RequestInit = {}) {
    const authHeader = await epinioAuth.authHeader(
      cluster.createAuthConfig(EpinioAuthTypes.AGNOSTIC)
    );

    const res = await fetch(`/pp/v1/direct/r/${cluster.id}${path}`, {
      ...opts,
      headers: {
        'content-type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...opts.headers,
      },
    });

    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('epinio:unauthorized', { detail: { clusterId: cluster.id } }));
    }

    const data = res.status === 204 ? null : await res.json().catch(() => null);

    if (!res.ok) {
      throw new EpinioApiError(data?.message || res.statusText, res.status, data);
    }

    return data;
  }

  return {
    get:    (path: string, opts?: RequestInit) => request(path, { ...opts, method: 'GET' }),
    post:   (path: string, body?: unknown, opts?: RequestInit) => request(path, { ...opts, method: 'POST', body: JSON.stringify(body) }),
    put:    (path: string, body?: unknown, opts?: RequestInit) => request(path, { ...opts, method: 'PUT', body: JSON.stringify(body) }),
    delete: (path: string, opts?: RequestInit) => request(path, { ...opts, method: 'DELETE' }),
  };
}