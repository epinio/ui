<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';

import DataTable from '../../../../components/tables/DataTable.vue';
import type { DataTableColumn } from '../../../../components/tables/types';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import LinkDetail from '@shell/components/formatter/LinkDetail.vue';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter.vue';

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
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP });
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

      <DataTable
        :rows="apps"
        :columns="columns"
      >
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
          <span
            v-else
            class="text-muted"
          >&nbsp;</span>
        </template>
      </DataTable>
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
