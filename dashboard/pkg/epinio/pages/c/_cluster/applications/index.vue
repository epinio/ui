<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import '@krumio/trailhand-ui/Components/data-table.js';
import '@krumio/trailhand-ui/Components/action-menu.js';

import type { DataTableColumn } from '../../../../components/tables/types';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';

import { EPINIO_TYPES } from '../../../../types';
import { createEpinioRoute } from '../../../../utils/custom-routing';

import { startPolling, stopPolling } from '../../../../utils/polling';
import { createLinkResolver, setupNavigationListener } from '../../../../utils/table-helpers';

const store = useStore();
const router = useRouter();
const t = store.getters['i18n/t'];

const resource = EPINIO_TYPES.APP;
const schema = ref(store.getters['epinio/schemaFor'](resource));

const createLocation = computed(() =>
  createEpinioRoute('c-cluster-applications-createapp', { cluster: store.getters['clusterId'] })
);

const openCreateRoute = () => {
  store.$router.push(createLocation.value);
};

const rows = computed(() => store.getters['epinio/all'](resource));

// Group applications by namespace
const groupedByNamespace = computed(() => {
  const groups: Record<string, any[]> = {};

  rows.value.forEach((app: any) => {
    const namespace = app.meta?.namespace || 'default';
    if (!groups[namespace]) {
      groups[namespace] = [];
    }
    groups[namespace].push(app);
  });

  return groups;
});

const pending = ref(true);

// Custom formatters
const formatRoutes = (_value: any, row: any) => {
  if (!row.routes || row.routes.length === 0) {
    return '-';
  }
  return row.routes.map((route: string) => route).join(', ');
};

const formatBoundConfigs = (_value: any, row: any) => {
  if (!row.allConfigurations || row.allConfigurations.length === 0) {
    return '-';
  }
  return row.allConfigurations.map((config: any) => config.meta.name).join(', ');
};

const formatBoundServices = (_value: any, row: any) => {
  if (!row.services || row.services.length === 0) {
    return '-';
  }
  return row.services.map((service: any) => service.meta.name).join(', ');
};

const columns: DataTableColumn[] = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px'
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    link: createLinkResolver(router, 'detailLocation')
  },
  {
    field: 'deployment.status',
    label: 'Status'
  },
  {
    field: 'routes',
    label: 'Routes',
    sortable: false,
    formatter: formatRoutes
  },
  {
    field: 'boundConfigs',
    label: 'Bound Configs',
    sortable: false,
    formatter: formatBoundConfigs
  },
  {
    field: 'boundServices',
    label: 'Bound Services',
    sortable: false,
    formatter: formatBoundServices
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

// Store references to table elements for each namespace
const tableRefs = ref<Record<string, HTMLElement>>({});

// Function to create/update table for a namespace
const createOrUpdateTable = (namespace: string, apps: any[]) => {
  const container = tableRefs.value[namespace];
  if (!container) return;

  // Remove existing table if any
  container.innerHTML = '';

  // Create new table element
  const tableElement = document.createElement('data-table');
  (tableElement as any).columns = columns;
  (tableElement as any).rows = apps;
  (tableElement as any).rowActions = true; // Enable actions
  container.appendChild(tableElement);

  // Listen for action menu events
  tableElement.addEventListener('action-click', ((event: CustomEvent) => {
    const { action, resource } = event.detail;
    handleAction(action, resource);
  }) as EventListener);

  // Listen for navigation events
  setupNavigationListener(tableElement, router);
};

// Handle action menu clicks
const handleAction = (action: any, resource: any) => {
  // action.action is the method name (e.g., 'showAppShell')
  const actionMethod = action.action;
  if (resource && actionMethod && typeof resource[actionMethod] === 'function') {
    resource[actionMethod]();
  }
};

// Watch for changes in grouped data
watch(groupedByNamespace, async (newGroups) => {
  await nextTick();
  Object.keys(newGroups).forEach(namespace => {
    createOrUpdateTable(namespace, newGroups[namespace]);
  });
}, { deep: true });

onMounted(async () => {
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP });
  // Non-blocking fetch
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });

  pending.value = false;

  // Create tables after data is loaded
  await nextTick();
  Object.keys(groupedByNamespace.value).forEach(namespace => {
    createOrUpdateTable(namespace, groupedByNamespace.value[namespace]);
  });

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
      <h3 class="namespace-header">
        Namespace: <span class="namespace-name">{{ namespace }}</span>
      </h3>

      <div :ref="el => { if (el) tableRefs[namespace] = el as HTMLElement }"></div>
    </div>
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
  font-size: 1.5rem;
  font-weight: 400;
  margin-bottom: 1rem;
  color: var(--body-text);

  .namespace-name {
    color: var(--link);
    font-weight: 500;
  }
}

.route {
  word-break: break-word;
}
</style>
