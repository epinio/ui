<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';

import DataTable from '../../../../components/tables/DataTable.vue';
import type { DataTableColumn } from '../../../../components/tables/types';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import LinkDetail from '@shell/components/formatter/LinkDetail.vue';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter.vue';
import BulkDeleteModal from '../../../../components/BulkDeleteModal.vue';

import { EPINIO_TYPES } from '../../../../types';
import { createEpinioRoute } from '../../../../utils/custom-routing';

import { startPolling, stopPolling } from '../../../../utils/polling';

const store = useStore();
const t = store.getters['i18n/t'];

const resource = EPINIO_TYPES.APP;
const schema = ref(store.getters['epinio/schemaFor'](resource));

const createLocation = computed(() =>
  createEpinioRoute('c-cluster-applications-createapp', { cluster: store.getters['clusterId'] })
);

const openCreateRoute = () => {
  store.$router.push(createLocation.value);
};

// Strict RBAC: only show Create when we know the user has app write perms (hides for view_only)
const canCreateApp = computed(() => {
  const can = store.getters['epinio/can'];
  const perms = store.getters['epinio/permissions']?.();

  // If we don't have a permission helper or a populated perms map yet, hide Create
  if (!can || !perms || Object.keys(perms).length === 0) {
    return false;
  }

  // Any of these actions implies the ability to create an app
  return can('app_create') || can('app_write') || can('app');
});

const canDeleteApp = computed(() => {
  const can = store.getters['epinio/can'];
  const perms = store.getters['epinio/permissions']?.();

  if (!can || !perms || Object.keys(perms).length === 0) {
    return false;
  }

  return can('app_delete') || can('app_write') || can('app');
});

const rows = computed(() => store.getters['epinio/all'](resource));
const allNamespaces = computed(() => store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE) || []);
const selectedAppIds = ref<string[]>([]);
const deletingSelected = ref(false);
const showDeleteModal = ref(false);
const deleteImage = ref(false);
const selectedCount = computed(() => selectedAppIds.value.length);

// Group applications by namespace. Include every namespace so the applications table
// is shown even when a namespace has no applications.
const groupedByNamespace = computed(() => {
  // Access the cache key to trigger namespace filter changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cacheKey = store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;

  const groups: Record<string, any[]> = {};

  // Determine which namespace names to show (all, or filtered)
  const showAll = !activeNamespaces || Object.keys(activeNamespaces).length === 0;
  const namespaceNamesToShow = new Set<string>();

  allNamespaces.value.forEach((ns: any) => {
    const name = ns.meta?.name || ns.name;
    if (name && (showAll || activeNamespaces[name])) {
      namespaceNamesToShow.add(name);
    }
  });

  // Initialize every visible namespace with an empty apps array
  namespaceNamesToShow.forEach((name) => {
    groups[name] = [];
  });

  // Assign each application to its namespace group
  rows.value.forEach((app: any) => {
    const namespace = app.meta?.namespace || 'default';
    if (namespaceNamesToShow.has(namespace)) {
      groups[namespace].push(app);
    }
  });

  // Fallback when no namespaces are loaded yet
  if (Object.keys(groups).length === 0) {
    groups['workspace'] = [];
  }

  return groups;
});

const pending = ref(true);

const columns: DataTableColumn[] = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px'
  },
  {
    field: 'nameDisplay',
    label: 'Name'
  },
  {
    field: 'deployment.status',
    label: 'Status'
  },
  {
    field: 'route',
    label: 'Routes',
    sortable: false
  },
  {
    field: 'boundConfigs',
    label: 'Bound Configs',
    sortable: false
  },
  {
    field: 'boundServices',
    label: 'Bound Services',
    sortable: false
  },
  {
    field: 'deployment.username',
    label: 'Last Deployed By'
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];

onMounted(async () => {
  await store.dispatch('epinio/me');
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP });
  // Ensure namespaces are loaded so we can show the applications table for every namespace (EPINIO-494)
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.NAMESPACE });
  // Non-blocking fetch
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });

  pending.value = false;
  // Removed 'catalogservices' - catalog services are static and don't need frequent polling
  // They're loaded on initial mount if needed, but don't change frequently
  startPolling(
    [
      'namespaces',
      'applications',
      'configurations',
      'services',
    ],
    store
  );
});

onUnmounted(() => {
  stopPolling([
    'namespaces',
    'applications',
    'configurations',
    'services'
  ]);
});

function appKey(app: any): string {
  return String(app?.id || `${ app?.meta?.namespace || 'default' }/${ app?.meta?.name || '' }`);
}

function selectedKeysForRows(apps: any[]) {
  const selectedSet = new Set(selectedAppIds.value);

  return apps.map((app) => appKey(app)).filter((id) => selectedSet.has(id));
}

function onSelectionChangeForNamespace(namespaceApps: any[], selectedAppsInNamespace: any[]) {
  const namespaceKeys = new Set(namespaceApps.map((app) => appKey(app)));
  const selectedNamespaceKeys = new Set(selectedAppsInNamespace.map((app) => appKey(app)));
  const remaining = selectedAppIds.value.filter((id) => !namespaceKeys.has(id));

  selectedAppIds.value = [...remaining, ...Array.from(selectedNamespaceKeys)];
}

const selectedApps = computed(() => {
  const selectedSet = new Set(selectedAppIds.value);
  return rows.value.filter((app: any) => selectedSet.has(appKey(app)));
});
const selectedAppLabels = computed(() => selectedApps.value.map((app: any) => `${ app.meta?.namespace }/${ app.meta?.name }`));

function openDeleteModal() {
  if (!canDeleteApp.value || selectedCount.value === 0 || deletingSelected.value) {
    return;
  }
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
}

async function deleteSelectedApps(payload?: { deleteImage: boolean }) {
  if (!selectedAppIds.value.length || deletingSelected.value) {
    return;
  }

  if (!selectedApps.value.length) {
    selectedAppIds.value = [];
    closeDeleteModal();
    return;
  }

  deletingSelected.value = true;
  try {
    deleteImage.value = !!payload?.deleteImage;
    selectedApps.value.forEach((app: any) => {
      app._deleteImage = deleteImage.value;
    });
    await selectedApps.value[0].bulkRemove(selectedApps.value, {});
    selectedAppIds.value = [];
    closeDeleteModal();
    await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP, opt: { force: true } });
  } catch (e: any) {
    await store.dispatch('growl/fromError', {
      title: t('generic.notification.error'),
      err: e
    }, { root: true });
  } finally {
    deletingSelected.value = false;
  }
}
</script>

<template>
  <Loading v-if="pending" />
  <div v-else>
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template #createButton>
        <button
          v-if="canDeleteApp"
          class="btn mr-10 bulk-delete-btn"
          :disabled="selectedCount === 0 || deletingSelected"
          @click="openDeleteModal"
        >
          {{ deletingSelected ? t('epinio.bulkDelete.deletingButton') : t('epinio.bulkDelete.button', { count: selectedCount }) }}
        </button>
        <button
          v-if="canCreateApp"
          class="btn role-primary"
          @click="openCreateRoute"
        >
          {{ t('generic.create') }}
        </button>
      </template>
    </Masthead>

    <div
      v-for="(apps, namespace) in groupedByNamespace"
      :key="namespace"
      class="namespace-group"
    >

      <DataTable
        :rows="apps"
        :columns="columns"
        :selectable="canDeleteApp"
        :selected-row-keys="selectedKeysForRows(apps)"
        @selection-change="onSelectionChangeForNamespace(apps, $event)"
      >
        <template #title>
          <h3 class="namespace-header">
            Namespace: <span class="namespace-name">{{ namespace }}</span>
          </h3>
        </template>
        <template #cell:stateDisplay="{ row }">
          <BadgeStateFormatter
            :row="row"
            :value="row.stateDisplay"
          />
        </template>
        <template #cell:nameDisplay="{ row }">
          <LinkDetail
            :row="row"
            :value="row.nameDisplay"
          />
        </template>
        <template #cell:route="{ row }">
          <span v-if="row.routes && row.routes.length" class="route">
            <template
              v-for="(route, index) in row.routes"
              :key="route.id || route"
            >
              <a
                v-if="row.state === 'running'"
                :href="`https://${route}`"
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {{ `https://${route}` }}
              </a>
              <span v-else>
                {{ `https://${route}` }}
              </span>
              <span v-if="index !== row.routes.length - 1">, </span>
            </template>
          </span>
          <span v-else class="text-muted">&nbsp;</span>
        </template>
        <template #cell:boundConfigs="{ row }">
          <span v-if="row.allConfigurations && row.allConfigurations.length">
            <template v-for="(config, index) in row.allConfigurations" :key="config.id">
              <LinkDetail
                :row="config"
                :value="config.meta.name"
              />
              <span
                v-if="index < row.allConfigurations.length - 1"
                :key="config.id + 'i'"
              >, </span>
            </template>
          </span>
          <span
            v-else
            class="text-muted"
          >&nbsp;</span>
        </template>
        <template #cell:boundServices="{ row }">
          <span v-if="row.services && row.services.length">
            <template v-for="(service, index) in row.services" :key="service.id">
              <LinkDetail
                :row="service"
                :value="service.meta.name"
              />
              <span
                v-if="index < row.services.length - 1"
                :key="service.id + 'i'"
              >, </span>
            </template>
          </span>
          <span v-else-if="row.configuration.services && row.configuration.services.length">
            <template v-for="(service, index) in row.configuration.services" :key="service">
              <span>{{ service }}</span>
              <span
                v-if="index < row.configuration.services.length - 1"
                :key="service + 'i'"
              >, </span>
            </template>
          </span>
          <span
            v-else
            class="text-muted"
          >&nbsp;</span>
        </template>
      </DataTable>
    </div>

    <BulkDeleteModal
      :show="showDeleteModal && canDeleteApp"
      :title="t('epinio.bulkDelete.titles.applications', { count: selectedApps.length })"
      :item-labels="selectedAppLabels"
      :deleting="deletingSelected"
      :show-delete-image="true"
      :description="t('epinio.bulkDelete.descriptions.applications')"
      @close="closeDeleteModal"
      @confirm="deleteSelectedApps"
    />
  </div>
</template>

<style lang="scss" scoped>
.namespace-group {
  margin-bottom: 2rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.namespace-header {
  font-size: 1.3rem;
  font-weight: 400;
  margin: 0;
  padding: 0;
  line-height: 1;
  color: var(--body-text);

  .namespace-name {
    color: var(--link);
    font-weight: 500;
  }
}

.route {
  word-break: break-word;
}

.bulk-delete-btn:disabled {
  background-color: var(--disabled-bg) !important;
  border-color: var(--border) !important;
  color: var(--disabled-text) !important;
  opacity: 1;
}

.bulk-delete-btn:not(:disabled) {
  background-color: var(--error) !important;
  border-color: var(--error) !important;
  color: var(--error-contrast, #fff) !important;
}

.bulk-delete-btn:not(:disabled):hover {
  filter: brightness(0.92);
}
</style>
