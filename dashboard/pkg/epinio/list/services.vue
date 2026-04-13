<script setup lang="ts">
import { onMounted, onUnmounted, ref, watchEffect } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

import { EPINIO_TYPES, EPINIO_SERVICE_PARAM } from '../types';
import { startPolling, stopPolling } from '../utils/polling';
import Masthead from '@shell/components/ResourceList/Masthead';
import { makeStateTag, makeRouterLink, makeRouterLinksOrEmpty, makeActionMenu } from '../utils/table-formatters';
import EpinioServiceModel from 'models/services';
import { overrideTableRows } from '../utils/table-formatters';
import ServiceDeleteModal from '../components/service/ServiceDeleteModal.vue';
import ServiceInstanceModal from '../components/service/ServiceInstanceModal.vue';

defineProps<{
  schema: object,
}>();

const store = useStore() as any;
const t = store.getters['i18n/t'];
const router = useRouter();

const resource: string = EPINIO_TYPES.SERVICE_INSTANCE;
const serviceModal = ref<InstanceType<typeof ServiceInstanceModal> | null>(null);
const deleteModal = ref<InstanceType<typeof ServiceDeleteModal> | null>(null);
const displayRows = ref<any[]>([]);

watchEffect(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE) as any[];

  all.forEach((row: any) => { void row.status; void row.stateDisplay; void row.meta; });

  // Filter empty rows that are added during delete
  const filtered = all.filter((row) => row.id);

  // Add custom service delete action to replace the built in rancher shell flow
  const overrideProps = [
    {
      prop: 'availableActions',
      value: (row: EpinioServiceModel) => (
        [
          {
            action: 'removeService',
            altAction: 'remove',
            bulkAction: 'removeService',
            bulkable: true, 
            enabled: row.canDelete,
            icon: 'icon icon-trash',
            label: 'Delete',
            weight: -10
          }, 
          {
            action: 'editServiceModal',
            label: 'Edit',
            enabled: true
          }
        ]
      ),
      conditionFn: (row: EpinioServiceModel) => {
        return true;
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
    },
    {
      prop: 'editServiceModal',
      value: (row: EpinioServiceModel) => () => {
        serviceModal.value?.openEdit(row);
      },
      conditionFn: (row: EpinioServiceModel) => {
        return true;
      }, 
    }
  ];

  const processedRows = overrideTableRows(filtered, overrideProps);

  displayRows.value = [...processedRows];
});

onMounted(() => {
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.NAMESPACE });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CATALOG_SERVICE });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP });
  startPolling(['services'], store);

  const query = store.$router.currentRoute._value.query;

  if (query.mode === 'openModal') {
    serviceModal.value?.openCreate(query[EPINIO_SERVICE_PARAM] as string | undefined);
  }
});

onUnmounted(() => {
  stopPolling(['services']);
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
    formatter: (_v: any, row: any) => {
      const el = document.createElement('a');

      el.textContent = row.nameDisplay || row.meta?.name || '';
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        serviceModal.value?.openView(row);
      });

      return el;
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
  <div id="modal-container-element">
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template #createButton>
        <trailhand-button
          variant="primary"
          size="large"
          @click="serviceModal?.openCreate()"
        >
          {{ t('generic.create') }}
        </trailhand-button>
      </template>
    </Masthead>
    <trailhand-table
      :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
      :rows="displayRows"
      :columns="columns"
      :searchable="true"
      key-field="id"
      @navigate="handleNavigate"
    />
    <ServiceInstanceModal ref="serviceModal" />
    <ServiceDeleteModal ref="deleteModal" />
  </div>
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
