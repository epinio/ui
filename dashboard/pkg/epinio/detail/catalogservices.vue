<script setup lang="ts">
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { ref, onMounted, watchEffect, onUnmounted } from 'vue';

import { startPolling, stopPolling } from '../utils/polling';
import EpinioCatalogServiceModel from '../models/catalogservices';
import { EPINIO_TYPES } from '../types';
import { makeStateTag, makeRouterLink, makeRouterLinksOrEmpty, overrideTableRows } from '../utils/table-formatters';
import ServiceDeleteModal from '../components/service/ServiceDeleteModal.vue';
import ServiceInstanceModal from '../components/service/ServiceInstanceModal.vue';
import EpinioServiceModel from 'models/services';
import { makeActionMenu } from '../utils/table-formatters';
import Masthead from '@shell/components/ResourceList/Masthead';

const store = useStore();
const router = useRouter();
const t = store.getters['i18n/t'];

const props = defineProps<{ value: EpinioCatalogServiceModel }>();

const deleteModal = ref<InstanceType<typeof ServiceDeleteModal> | null>(null);
const serviceModal = ref<InstanceType<typeof ServiceInstanceModal> | null>(null);
const displayRows = ref<any[]>([]);

watchEffect(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE) as any[];

  // Filter empty rows that are added during delete and only show services related to this catalog service
  const filtered = all.filter((row: any) => row.id && row.catalog_service === props.value.id);

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
  displayRows.value = processedRows;
})

onMounted(() => {
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.NAMESPACE });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CATALOG_SERVICE });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP });
  startPolling(['services'], store);
});

onUnmounted(() => {
  stopPolling(['services']);
})

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
    sortable:  false,
    formatter: (_v: any, row: any) => makeRouterLink(row.catalog_service, row.serviceLocation, router)
  },
  {
    field: 'catalog_service_version',
    label: 'Catalog Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable:  false,
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
      :schema="value"
      :resource="value.id"
      :type-display="t('epinio.catalogService.detail.servicesTitle', { catalogService: props.value.name })"
    >
      <template #subHeader>
        <p class="description">{{ value.description ?? '' }}</p>
      </template>
      <template #createButton>
        <trailhand-button
          variant="primary"
          size="large"
          @click="serviceModal?.openCreate(value.id)"
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
    <ServiceDeleteModal ref="deleteModal" />
    <ServiceInstanceModal ref="serviceModal" />
  </div>
</template>

<style lang="scss" scoped>
.description {
  max-width: 60%;
  color: var(--deemphasized);
}
trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}
</style>
