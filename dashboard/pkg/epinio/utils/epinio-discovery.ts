import { MANAGEMENT } from '@shell/config/types';
import { ingressFullPath } from '@shell/models/networking.k8s.io.ingress';
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import EpinioCluster from '../models/epiniomgmt/epinio.io.management.cluster';
import { dashboardUrl } from './embedded-helpers';

class EpinioDiscovery {
  ingressUrl(clusterId: string, namespace: string) {
    return `/k8s/clusters/${ clusterId }/v1/networking.k8s.io.ingresses/${ namespace }/epinio`;
  }

  async discover(store: any) {
    const allClusters = await store.dispatch('management/findAll', { type: MANAGEMENT.CLUSTER }, { root: true });
    const epinioClusters = [];

    for (const c of allClusters.filter((c: any) => c.isReady)) {
      try {
        // Try to discover the namespace epinio is installed to
        const namespace = await this.findNamespace(store, c.id);

        // Get the url first, if it has this it's highly likely it's an epinio cluster
        const epinioIngress = await store.dispatch(`cluster/request`, { url: this.ingressUrl(c.id, namespace) }, { root: true });
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
          namespace,
          api:         url,
          loggedIn:    !!loggedIn,
          mgmtCluster: c
        }, { rootGetters: store.getters }));
      } catch (err) {
        console.debug(`Skipping epinio discovery for ${ c.spec.displayName }:`, err);
      }
    }

    return epinioClusters;
  }

  private async findNamespace(store: any, clusterId: string): Promise<string> {
    const url = `/k8s/clusters/${clusterId}/v1/apps.deployments`;

    const deployments = await store.dispatch('cluster/request', { url }, { root: true });

    const epinioDeployments = deployments?.data.filter((d: any) =>
      d.metadata?.labels?.['app.kubernetes.io/component'] === 'epinio' &&
      d.metadata?.labels?.['app.kubernetes.io/name'] === 'epinio-server'
    );

    if (epinioDeployments.length === 0) {
      return Promise.reject(new Error('Could not find epinio-server deployment'));
    }

    if (epinioDeployments.length > 1) {
      return Promise.reject(new Error('Found too many epinio-server deployments'));
    }

    return epinioDeployments[0].metadata.namespace;
  }
}


const epinioDiscovery = new EpinioDiscovery();

export default epinioDiscovery;
