import { importTypes } from '@rancher/auto-import';
import {
  ActionLocation, ActionOpts, IPlugin, OnNavAwayFromPackage, OnNavToPackage
} from '@shell/core/types';
import { EPINIO_TYPES } from './types';
import epinioRoutes from './routing/epinio-routing';
import epinioMgmtStore from './store/epinio-mgmt-store';
import epinioStore from './store/epinio-store';
import { createEpinioRoute } from './utils/custom-routing';

const epinioObjAnnotations = [
  'epinio.io/app-container',
  'epinio.io/created-by'
];

const isPodFromEpinio = (a: string) => epinioObjAnnotations.includes(a);

const onEnter: OnNavToPackage = async({ getters, dispatch }, config) => {
  await dispatch(`${ epinioMgmtStore.config.namespace }/loadManagement`);

  if (getters['isSingleProduct']) {
    dispatch(`${ epinioStore.config.namespace }/info`); // We can get this in the background
  }
};

const onLeave: OnNavAwayFromPackage = async(store, config) => {
  // The dashboard retains the previous cluster info until another cluster is loaded, this helps when returning to the same cluster.
  // We need to forget epinio cluster info
  // - The polling is pretty brutal
  // - The nav path through to the same epinio cluster is fraught with danger (nav from previous cluster id to blank cluster, required to switch epinio clusters)
  await store.dispatch(`${ epinioStore.config.namespace }/unsubscribe`);
  await store.commit(`${ epinioStore.config.namespace }/reset`);
};

// Init the package
export default function(plugin: IPlugin) {
  // Auto-import model, detail, edit from the folders
  importTypes(plugin);

  // Provide plugin metadata from package.json
  plugin.metadata = require('./package.json');

  // Load a product
  plugin.addProduct(require('./config/epinio'));

  // Add Vuex stores
  plugin.addDashboardStore(epinioMgmtStore.config.namespace, epinioMgmtStore.specifics, epinioMgmtStore.config);
  plugin.addDashboardStore(epinioStore.config.namespace, epinioStore.specifics, epinioStore.config);

  // Add Vue Routes
  plugin.addRoutes(epinioRoutes);

  // Add hooks to Vue navigation world
  plugin.addNavHooks(onEnter, onLeave);

  // Add action button in the menu of each object belonging to Epinio's applications
  plugin.addAction(
    ActionLocation.TABLE,
    {
      resource: [
        'apps.deployment',
        'batch.job',
        'pod',
        // 'service',
        'workload'
      ]
    },
    {
      labelKey: 'epinio.applications.actions.goToEpinio.label',
      icon:     'icon-epinio',
      enabled(ctx: any) {
        const isUserNamespace = ctx.metadata.namespace !== 'epinio';

        return isUserNamespace && !!Object.keys(ctx.metadata.annotations || []).find((annotation) => isPodFromEpinio(annotation));
      },
      invoke(_: ActionOpts, values: any[]) {
        const obj = values[0];
        const $router = obj.$rootState.$router;

        const epinioNamespace = obj.labels['app.kubernetes.io/part-of'];
        const epinioAppName = obj.labels['app.kubernetes.io/name'];

        $router.replace(createEpinioRoute(`c-cluster-resource-id`, {
          cluster:  obj.$rootGetters['clusterId'],
          resource: EPINIO_TYPES.APP,
          id:       `${ epinioNamespace }/${ epinioAppName }`
        }));
      }
    }
  );
}
