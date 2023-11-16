import { MANAGEMENT } from '@shell/config/types';
import { ingressFullPath } from '@shell/models/networking.k8s.io.ingress';
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import EpinioCluster from '../models/cluster';
import { dashboardUrl } from './embedded-helpers';

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
        const loggedIn = await epinioAuth.isLoggedIn({
          type:      EpinioAuthTypes.AGNOSTIC,
          epinioUrl: url,
          dexConfig: {
            dashboardUrl: dashboardUrl(),
            dexUrl:       url.replace('epinio', 'auth')
          },
        });

        epinioClusters.push(new EpinioCluster({
          id:          c.id,
          name:        c.spec.displayName,
          api:         url,
          loggedIn:    !!loggedIn,
          mgmtCluster: c
        }, { rootGetters: store.getters }));
      } catch (err) {
        console.info(`Skipping epinio discovery for ${ c.spec.displayName }`, err); // eslint-disable-line no-console
      }
    }

    return epinioClusters;
  }
};
