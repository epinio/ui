import {
  AGE, NAME, RAM, SIMPLE_NAME, STATE
} from '@shell/config/table-headers';
import { createEpinioRoute, rootEpinioRoute } from '../utils/custom-routing';
import { EPINIO_PRODUCT_NAME, EPINIO_STANDALONE_CLUSTER_NAME, EPINIO_TYPES } from '../types';
import EpinioDiscovery from '../utils/epinio-discovery';
import { MULTI_CLUSTER } from '@shell/store/features';

export const BLANK_CLUSTER = '_';

export function init($plugin: any, store: any) {
  const {
    product,
    basicType,
    headers,
    configureType,
    spoofedType,
    weightType,
    virtualType,
    weightGroup
  } = $plugin.DSL(store, $plugin.name);

  const isEpinioSingleProduct = process.env.rancherEnv === 'epinio';
  
  if (isEpinioSingleProduct) {
    store.dispatch('setIsSingleProduct', {
      logo:                require(`../assets/logo-epinio.svg`), // eslint-disable-line @typescript-eslint/no-require-imports
      productNameKey:      'epinio.label',
      aboutPage:           createEpinioRoute('c-cluster-about', { cluster: EPINIO_STANDALONE_CLUSTER_NAME }),
      afterLoginRoute:     createEpinioRoute('c-cluster-dashboard', { cluster: EPINIO_STANDALONE_CLUSTER_NAME }),
      logoRoute:           createEpinioRoute('c-cluster-dashboard', { cluster: EPINIO_STANDALONE_CLUSTER_NAME }),
      disableSteveSockets: true,
      getVersionInfo:      (store:any) => {
        const { displayVersion } = store.getters[`${ EPINIO_PRODUCT_NAME }/version`]() || { };

        return displayVersion || 'unknown';
      },
    });
  }

  product({
    // ifHaveType:          CAPI.RANCHER_CLUSTER,
    weight: 100,
    ifFeature:             MULTI_CLUSTER,
    category:              EPINIO_PRODUCT_NAME,
    isMultiClusterApp:     true,
    inStore:               EPINIO_PRODUCT_NAME,
    icon:                  'epinio',
    iconHeader:            isEpinioSingleProduct ? undefined : require(`../assets/logo-epinio.svg`), // eslint-disable-line @typescript-eslint/no-require-imports
    removable:             false,
    showClusterSwitcher:   false,
    to:                    rootEpinioRoute(),
    showNamespaceFilter:   true,
    customNamespaceFilter: true,
  });

  // Internal Types

  //// Multi-cluster view
  spoofedType({
    label:             store.getters['type-map/labelFor']({ id: EPINIO_TYPES.CLUSTER }, 2),
    type:              EPINIO_TYPES.CLUSTER,
    product:           EPINIO_PRODUCT_NAME,
    collectionMethods: [],
    schemas:           [{
      id:                EPINIO_TYPES.CLUSTER,
      type:              'schema',
      collectionMethods: [],
      resourceFields:    {},
    }],
    getInstances: async() => await EpinioDiscovery.discover(store),
  });

  configureType(EPINIO_TYPES.CLUSTER, {
    isCreatable: false,
    isEditable:  false,
    isRemovable: false,
    showState:   false,
    showAge:     false,
    canYaml:     false,
  });
  configureType(EPINIO_TYPES.CLUSTER, { customRoute: createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.CLUSTER }) });

  headers(EPINIO_TYPES.CLUSTER, [
    STATE,
    {
      name:     'name',
      labelKey: 'tableHeaders.simpleName',
      sort:     ['name'],
    },
    {
      name:     'version',
      labelKey: 'epinio.instances.tableHeaders.version',
      sort:     ['version'],
      value:    'version'
    },
    {
      name:     'api',
      labelKey: 'epinio.instances.tableHeaders.api',
      sort:     ['api'],
    },
    {
      name:     'rancherCluster',
      labelKey: 'epinio.instances.tableHeaders.cluster',
      sort:     ['mgmtCluster.nameDisplay'],
      value:    'mgmtCluster.nameDisplay'
    },
  ]);

  //// Standalone app components
  // App resource
  configureType(EPINIO_TYPES.APP, {
    isCreatable: true,
    isEditable:  true,
    isRemovable: true,
    showState:   true,
    canYaml:     false,
    customRoute: createEpinioRoute('c-cluster-applications', { }),
  });

  virtualType({
    label:      store.getters['i18n/t']('epinio.intro.dashboard'),
    icon:       'dashboard',
    group:      'Root',
    namespaced: false,
    name:       EPINIO_TYPES.DASHBOARD,
    route:      createEpinioRoute('c-cluster-dashboard', { })
  });

  // App Chart resource
  configureType(EPINIO_TYPES.APP_CHARTS, {
    isCreatable: false,
    isEditable:  false,
    isRemovable: false,
    showState:   false,
    canYaml:     false,
    customRoute: createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.APP_CHARTS }),
  });

  // Configuration resource
  configureType(EPINIO_TYPES.CONFIGURATION, {
    isCreatable: true,
    isEditable:  true,
    isRemovable: true,
    showState:   false,
    canYaml:     false,
    customRoute: createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.CONFIGURATION }),
  });

  // Groups
  const ADVANCED_GROUP = 'Advanced';
  const SERVICE_GROUP = 'Services';
  const ABOUT = 'System';

  // Service Instance
  configureType(EPINIO_TYPES.SERVICE_INSTANCE, {
    isCreatable: true,
    isEditable:  true,
    isRemovable: true,
    showState:   true,
    canYaml:     false,
    customRoute: createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.SERVICE_INSTANCE }),
  });

  // Catalog Service
  configureType(EPINIO_TYPES.CATALOG_SERVICE, {
    isCreatable: false,
    isEditable:  false,
    isRemovable: false,
    showState:   false,
    canYaml:     false,
    customRoute: createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.CATALOG_SERVICE }),
  });

  // Namespace resource
  configureType(EPINIO_TYPES.NAMESPACE, {
    isCreatable:      true,
    isEditable:       true,
    isRemovable:      true,
    showState:        false,
    canYaml:          false,
    customRoute:      createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.NAMESPACE }),
    showListMasthead: false // Disable default masthead because we provide a custom one.
  });

  virtualType({
    label:      store.getters['i18n/t']('epinio.intro.about'),
    icon:       'dashboard',
    // group:      'Root',
    namespaced: false,
    name:       EPINIO_TYPES.ABOUT,
    route:      createEpinioRoute('c-cluster-about', { })
  });

  // Side Nav
  weightType(EPINIO_TYPES.CATALOG_SERVICE, 150, true);
  weightType(EPINIO_TYPES.SERVICE_INSTANCE, 151, true);
  basicType([
    EPINIO_TYPES.SERVICE_INSTANCE,
    EPINIO_TYPES.CATALOG_SERVICE,
  ], SERVICE_GROUP);

  weightType(EPINIO_TYPES.CONFIGURATION, 200, true);
  weightType(EPINIO_TYPES.APP_CHARTS, 150, true);
  basicType([
    EPINIO_TYPES.CONFIGURATION,
    EPINIO_TYPES.APP_CHARTS
  ], ADVANCED_GROUP);

  if (isEpinioSingleProduct) {
    basicType([
      EPINIO_TYPES.ABOUT
    ], ABOUT);
  }

  weightType(EPINIO_TYPES.DASHBOARD, 300, true);
  weightType(EPINIO_TYPES.APP, 250, true);
  weightType(EPINIO_TYPES.NAMESPACE, 100, true);
  weightGroup(SERVICE_GROUP, 30, true);
  weightGroup(ADVANCED_GROUP, 20, true);
  weightGroup(ABOUT, 10, false);

  basicType([
    EPINIO_TYPES.DASHBOARD,
    EPINIO_TYPES.APP,
    EPINIO_TYPES.NAMESPACE,
    SERVICE_GROUP,
    ADVANCED_GROUP,
    ABOUT
  ]);

  headers(EPINIO_TYPES.APP, [
    STATE,
    NAME,
    {
      name:     'namespace',
      labelKey: 'epinio.tableHeaders.namespace',
      value:    'meta.namespace',
      sort:     ['meta.namespace'],
    },
    {
      name:     'dep-status',
      labelKey: 'tableHeaders.status',
      value:    'deployment.status',
      sort:     ['deployment.status'],
    },
    {
      name:     'route',
      labelKey: 'epinio.applications.tableHeaders.route',
      value:    'configuration.route',
      search:   ['configuration.route'],
    },
    {
      name:     'configurations',
      labelKey: 'epinio.applications.tableHeaders.boundConfigs',
      search:   ['baseConfigurationsNames'],
    },
    {
      name:     'services',
      labelKey: 'epinio.applications.tableHeaders.boundServices',
      search:   ['serviceConfigurationsNames'],
    },
    {
      name:     'deployedBy',
      labelKey: 'epinio.applications.tableHeaders.deployedBy',
      value:    'deployment.username',
      sort:     ['deployment.username'],
    },
    AGE
  ]);

  const { ...instanceName } = SIMPLE_NAME;

  headers(EPINIO_TYPES.APP_INSTANCE, [
    STATE,
    instanceName,
    {
      name:   'millicpus',
      label:  'Milli CPUs',
      value:  'millicpus',
      sort:   ['millicpus'],
      search: false,
    },
    {
      ...RAM,
      sort:      ['memoryBytes'],
      search:    false,
      value:     'memoryBytes',
      formatter: 'Si',
    },
    {
      name:  'restarts',
      label: 'Restarts',
      value: 'restarts',
      sort:  ['restarts'],
    },
    {
      ...AGE,
      value: 'createdAt',
      sort:  'createdAt:desc',
    }
  ]);

  headers(EPINIO_TYPES.NAMESPACE, [
    SIMPLE_NAME,
    {
      name:     'applications',
      labelKey: 'epinio.namespace.tableHeaders.appCount',
      value:    'appCount',
      sort:     ['appCount'],
    },
    {
      name:     'configurations',
      labelKey: 'epinio.namespace.tableHeaders.configCount',
      value:    'configCount',
      sort:     ['configCount'],
    },
    AGE
  ]);

  

  headers(EPINIO_TYPES.CONFIGURATION, [
    NAME,
    {
      name:     'namespace',
      labelKey: 'epinio.tableHeaders.namespace',
      value:    'meta.namespace',
      sort:     ['meta.namespace'],
    },
    {
      name:     'boundApps',
      labelKey: 'epinio.configurations.tableHeaders.boundApps',
      search:   ['configuration.boundapps'],
    },
    {
      name:     'service',
      labelKey: 'epinio.configurations.tableHeaders.service.label',
      sort:     ['origin'],
      search:   ['origin'],
      tooltip:  store.getters['i18n/t']('epinio.configurations.tableHeaders.service.tooltip')
    },
    {
      name:     'count',
      labelKey: 'epinio.configurations.tableHeaders.variableCount',
      value:    'variableCount',
      sort:     ['variableCount'],
    },
    {
      name:     'createdBy',
      labelKey: 'epinio.configurations.tableHeaders.createBy',
      value:    'configuration.user',
      sort:     ['configuration.user'],
    },
    AGE
  ]);

  headers(EPINIO_TYPES.SERVICE_INSTANCE, [
    STATE,
    NAME,
    {
      name:     'namespace',
      labelKey: 'epinio.tableHeaders.namespace',
      value:    'metadata.namespace',
      sort:     ['metadata.namespace'],
    },
    {
      name:          'catalog_service',
      labelKey:      'epinio.serviceInstance.tableHeaders.service',
      value:         'catalog_service',
      sort:          ['catalog_service'],
      formatter:     'LinkDetail',
      formatterOpts: { reference: 'serviceLocation' }
    },
    {
      name:     'catalog_service_version',
      labelKey: 'epinio.serviceInstance.tableHeaders.serviceVersion',
      value:    'catalog_service_version',
      sort:     ['catalog_service_version'],
    },
    {
      name:     'boundApps',
      labelKey: 'epinio.configurations.tableHeaders.boundApps',
      value:    'applications',
      search:   ['boundapps'],
    },
    AGE
  ]);

  headers(EPINIO_TYPES.CATALOG_SERVICE, [
    SIMPLE_NAME,
    {
      name:     'short_description',
      labelKey: 'epinio.catalogService.tableHeaders.shortDesc',
      value:    'short_description',
      sort:     ['short_description'],
    },
    {
      name:     'description',
      labelKey: 'epinio.catalogService.tableHeaders.desc',
      value:    'description',
      sort:     ['description'],
    },
    AGE
  ]);

  headers(EPINIO_TYPES.APP_CHARTS, [
    SIMPLE_NAME,
    {
      name:     'description',
      labelKey: 'epinio.catalogService.tableHeaders.desc',
      value:    'description',
      sort:     ['description'],
    },
    {
      name:  'helm_chart',
      label: 'Helm Chart',
      value: 'helm_chart',
      sort:  ['helm_chart'],
    },
    AGE
  ]);
}
