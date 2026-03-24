<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

import { EPINIO_TYPES } from '../types';
import { startPolling, stopPolling } from '../utils/polling';
import Masthead from '@shell/components/ResourceList/Masthead';
import { createEpinioRoute } from '../utils/custom-routing';
import { makeStateTag, makeRouterLink, makeRouterLinksOrEmpty, makeActionMenu } from '../utils/table-formatters';
import EpinioServiceModel from 'models/services';
import { overrideTableRows } from '../utils/table-formatters';
import ServiceDeleteModal from '../components/service/ServiceDeleteModal.vue';

defineProps<{
  schema: object,
}>();

const resource: string = EPINIO_TYPES.SERVICE_INSTANCE;

const store = useStore();
const router = useRouter();

const deleteModal = ref<InstanceType<typeof ServiceDeleteModal> | null>(null);

onMounted(() => {
  store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  startPolling(['services'], store);
});

onUnmounted(() => {
  stopPolling(['services']);
});

const handleCreateClick = () => {
  store.$router.push(createEpinioRoute('c-cluster-resource-create', { resource: EPINIO_TYPES.SERVICE_INSTANCE }));
};

const rows = computed(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE) as any[];

  all.forEach((row: any) => { void row.status; void row.stateDisplay; void row.meta; });

  // Filter empty rows that are added during delete
  const filtered = all.filter((row) => row.id);

  // Add custom service delete action to replace the built in rancher shell flow
  const overrideProps = [{
    prop: 'availableActions',
    value: (row: EpinioServiceModel) => {
      const newActions: any[] = [];
      const availableActions = row.availableActions || [];
      availableActions.forEach((action) => {
        if (action.action === 'promptRemove') {
          newActions.push({
            action: 'removeService',
            altAction: 'remove',
            bulkAction: 'removeService',
            bulkable: true,
            enabled: row.canDelete,
            icon: 'icon icon-trash',
            label: 'Delete',
            weight: -10
          });
        } else {
          newActions.push(action);
        }
      });
      return newActions;
    },
    conditionFn: (row: EpinioServiceModel) => {
      return row.canDelete;
    },
  },
  {
    prop: 'removeService',
    value: (row: EpinioServiceModel) => () => {
      deleteModal.value?.openDelete(row);
    },
    conditionFn: (row: EpinioServiceModel) => {
      return row.canDelete;
    },
  }];

  const processedRows = overrideTableRows(filtered, overrideProps);
  return processedRows;
});

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};


const columns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px',
    formatter: (_v: any, row: any) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    link:  (row: any) => {
      try { return router.resolve(row.detailLocation).href; } catch { return '#'; }
    }
  },
  {
    field: 'catalog_service',
    label: 'Catalog Service',
    sortable: false,
    formatter: (_v: any, row: any) => makeRouterLink(row.catalog_service, row.serviceLocation, router)
  },
  {
    field: 'catalog_service_version',
    label: 'Catalog Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false,
    formatter: (_v: any, row: any) => makeRouterLinksOrEmpty(row.applications, router)
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];
</script>

<template>
  <Masthead
    :schema="schema"
    :resource="resource"
  >
    <template #createButton>
      <trailhand-button
        variant="primary"
        size="large"
        @click="handleCreateClick"
      >
        {{ t('generic.create') }}
      </trailhand-button>
    </template>
  </Masthead>
  <trailhand-table
    :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
    :rows="rows"
    :columns="columns"
    :searchable="true"
    key-field="id"
    @navigate="handleNavigate"
  />
  <ServiceDeleteModal ref="deleteModal" />
</template>

<style lang="scss" scoped>
trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 500px;
}
</style>
