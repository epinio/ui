import { EPINIO_TYPES } from '../types';

import { MANAGEMENT } from '@shell/config/types';
import { ingressFullPath } from '@shell/models/networking.k8s.io.ingress';
import { allHash } from '@shell/utils/promise';
// import { allHash } from '@shell/utils/promise';
import Resource from '@shell/plugins/dashboard-store/resource-class';

export interface EpinioCluster extends Resource {
  id: string,
  name: string,
  state: string,
  api: string,
  readyApi: string,
  type: string,
  mgmtCluster: any
}

export default {
  ingressUrl(clusterId: string) {
    return `/k8s/clusters/${ clusterId }/v1/networking.k8s.io.ingresses/epinio/epinio`;
  },

  async discover(store: any) {
    const allClusters = await store.dispatch('management/findAll', { type: MANAGEMENT.CLUSTER }, { root: true });
    const epinioClusters = [];

    for (const c of allClusters.filter((c: any) => c.isReady)) {
      try {
        // Get the url first, if it has this it's highly likely it's an epinio cluster
        const epinioIngress = await store.dispatch(`cluster/request`, { url: this.ingressUrl(c.id) }, { root: true });
        const url = ingressFullPath(epinioIngress, epinioIngress.spec.rules?.[0]);

        let username;
        let password;

        if (url) {
          // TODO: RC hack. remove once dex is in

          username = 'admin';
          password = 'password';
        } else {
          // TODO: RC old. to remove
          const epinio: any = await allHash({ authData: store.dispatch(`cluster/request`, { url: `/k8s/clusters/${ c.id }/v1/secrets/epinio/default-epinio-user` }, { root: true }) });

          username = epinio.authData.data.username;
          password = epinio.authData.data.password;
        }

        epinioClusters.push({
          id:          c.id,
          name:        c.spec.displayName,
          api:         url,
          // readyApi:    `${ url }/ready`, // Calls to `/ready` currently throw CORS error (but not `/api/v1`).
          readyApi:    `/api/v1/info`, // Calls to `/api/v1/info` currently need auth
          // username:    base64Decode(username),
          // password:    base64Decode(password),
          username,
          password,
          type:        EPINIO_TYPES.INSTANCE,
          mgmtCluster: c
        });
      } catch (err) {
        console.info(`Skipping epinio discovery for ${ c.spec.displayName }`, err); // eslint-disable-line no-console
      }
    }

    return epinioClusters;
  }
};
