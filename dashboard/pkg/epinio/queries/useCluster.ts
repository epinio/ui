// pkg/epinio/composables/useEpinioCluster.ts
import { useQuery } from '@tanstack/vue-query';
import type { EpinioClusterContext } from '../api/client';
import { EpinioAuthTypes } from '../utils/auth';
import { dashboardUrl } from '../utils/embedded-helpers';
import { EPINIO_MGMT_STORE, EPINIO_TYPES } from '../types';
import { epinioQueryClient } from '../api/queryClient';

const EPINIO_STANDALONE_CLUSTER_NAME = 'default'; // match existing constant

function urlFromEndpoint(endpoint: string | Record<string, any>): string {
  if (typeof endpoint === 'string') {
    return endpoint;
  }

  const { Scheme, Host, Path } = endpoint;
  return `${Scheme}://${Host}${Path || ''}`;
}

// One-time bootstrap: still a Rancher-backend call, but that's it.
async function fetchStandaloneCluster(): Promise<EpinioClusterContext> {
  console.log('fetchStandaloneCluster');
  const res = await fetch('/pp/v1/endpoints', { credentials: 'include' });
  const endpoints = await res.json();
  console.log('fetchStandaloneCluster endpoints', endpoints);
  const cnsi = endpoints.find((e: any) => e.name === EPINIO_STANDALONE_CLUSTER_NAME);

  if (!cnsi?.api_endpoint) {
    throw new Error('Could not resolve standalone Epinio API endpoint');
  }

  console.log('fetchStandaloneCluster cnsi', cnsi);
  const api = urlFromEndpoint(cnsi.api_endpoint);

  console.log('fetchStandaloneCluster', { cnsi, api });

  return {
    id: cnsi.guid,
    api,
    createAuthConfig: (type: EpinioAuthTypes) => ({
      type,
      epinioUrl: api,
      dexConfig: {
        dashboardUrl: dashboardUrl(),
        dexUrl: cnsi.authorization_endpoint,
      },
    }),
  };
}

function fetchExtensionCluster(store: any): EpinioClusterContext {
  const currentClusterId = store.getters['clusterId'];
  console.log('currentClusterId', currentClusterId);
  const currentCluster = store.getters[`${ EPINIO_MGMT_STORE }/byId`](
    EPINIO_TYPES.CLUSTER,
    currentClusterId,
  );
  console.log('currentCluster', currentCluster);
  return currentCluster;
}

export function useCluster(store: any) {
  const isSingleProduct = !!store.getters['isSingleProduct'];
  return useQuery({
    queryKey: ['epinio', `${ isSingleProduct ? 'standalone' : 'extension' }-cluster`],
    queryFn:  isSingleProduct ? fetchStandaloneCluster : () => fetchExtensionCluster(store),
    staleTime: Infinity, // this doesn't change during a session
  }, epinioQueryClient);
}