/**
 * Maps common trailhand-table column `field` values to API `sort` values.
 * Fields not listed are not sent to the server.
 */
export const DEFAULT_SORT_FIELD_MAP: Record<string, string> = {
  nameDisplay: 'name',
  'meta.name': 'name',
  name: 'name',
  'meta.createdAt': 'createdAt',
  createdAt: 'createdAt',
  age: 'createdAt',
  'meta.namespace': 'namespace',
  namespace: 'namespace',
  // Apps
  stateDisplay: 'status',
  status: 'status',
  'deployment.status': 'deploymentStatus',
  'deployment.username': 'username',
  buildStatus: 'buildStatus',
  builtImageUrl: 'builtImageUrl',
  // Configurations
  'configuration.user': 'username',
  'configuration.variableCount': 'variableCount',
  // Services
  catalogServiceVersion: 'catalogServiceVersion',
  // Namespaces
  appCount: 'appCount',
  configCount: 'configCount',
  serviceInstanceCount: 'serviceInstanceCount',
  // Builder images / app charts / gitconfigs
  description: 'description',
  image: 'image',
  helmChart: 'helmChart',
  provider: 'provider',
  url: 'url',
};

export type SortFieldMap = Record<string, string>;

