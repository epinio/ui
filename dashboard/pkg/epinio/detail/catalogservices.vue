<script setup lang="ts">
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { computed, ref, onMounted, watchEffect, onUnmounted } from 'vue';

import { startPolling, stopPolling } from '../utils/polling';
import EpinioCatalogServiceModel from '../models/catalogservices';
import { EPINIO_TYPES } from '../types';
import { makeStateTag, makeRouterLink, makeRouterLinksOrEmpty, overrideTableRows } from '../utils/table-formatters';
import ServiceDeleteModal from '../components/service/ServiceDeleteModal.vue';
import ServiceInstanceModal from '../components/service/ServiceInstanceModal.vue';
import EpinioServiceModel from 'models/services';
import { makeActionMenu } from '../utils/table-formatters';
import Masthead from '@shell/components/ResourceList/Masthead';
import CatalogServiceModal from '../components/service/CatalogServiceModal.vue';
import CatalogServiceDeleteModal from '../components/service/CatalogServiceDeleteModal.vue';

const store = useStore();
const router = useRouter();
const t = store.getters['i18n/t'];

const props = defineProps<{ value: EpinioCatalogServiceModel }>();

const serviceDeleteModal = ref<InstanceType<typeof ServiceDeleteModal> | null>(null);
const serviceModal = ref<InstanceType<typeof ServiceInstanceModal> | null>(null);
const catalogServiceModal = ref<InstanceType<typeof CatalogServiceModal> | null>(null);
const catalogServiceDeleteModal = ref<InstanceType<typeof CatalogServiceDeleteModal> | null>(null);
const displayRows = ref<any[]>([]);

const canEditService = computed(() => {
  const can = store.getters['epinio/can'];

  return can && (can('service_write') || can('service'));
});
const canDeleteService = canEditService;
const canCreateService = canEditService;

const canEditCatalogService = computed(() => {
  const can = store.getters['epinio/can'];

  return can && (can('catalog_service_write') || can('catalog_service'));
});
const canDeleteCatalogService = canEditCatalogService;

const availableActions = computed(() => {
    const rowActions = (row: EpinioCatalogServiceModel) => {
    const out: any[] = [];

    if (canCreateService.value) {
      out.push({
        label: 'Create Service',
        enabled: true,
        action: () => serviceModal.value?.openCreate(row.id)
      });
    }
    if (canEditCatalogService.value) {
      out.push({
        label: 'Edit',
        enabled: true,
        action: () => catalogServiceModal.value?.openEdit(row),

      });
    }
    if (canDeleteCatalogService.value) {
      out.push({
        enabled: true,
        label: 'Delete',
        action: () => catalogServiceDeleteModal.value?.openDelete(row),
      });
    }

    return out;
  };

  return rowActions(props.value);
});

watchEffect(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE) as any[];

  // Filter empty rows that are added during delete and only show services related to this catalog service
  const filtered = all.filter((row: any) => row.id && row.catalog_service === props.value.id);

  // Build the row action menu with RBAC gating. Inject the modal-driven
  // Edit/Delete entries only when the user has service write permissions.
  const rowActions = (row: EpinioServiceModel) => {
    const out: any[] = [];

    if (canDeleteService.value) {
      out.push({
        action: 'removeService',
        altAction: 'remove',
        bulkAction: 'removeService',
        bulkable: true,
        enabled: row.canDelete,
        icon: 'icon icon-trash',
        label: 'Delete',
        weight: -10
      });
    }
    if (canEditService.value) {
      out.push({
        action: 'editServiceModal',
        label: 'Edit',
        enabled: true
      });
    }

    return out;
  };

  const overrideProps = [
      {
        prop: 'availableActions',
        value: rowActions,
        conditionFn: () => true,
      },
      {
        prop: 'removeService',
        value: (row: EpinioServiceModel) => () => {
          serviceDeleteModal.value?.openDelete(row);
        },
        conditionFn: (row: EpinioServiceModel) => canDeleteService.value && row.canDelete,
      },
      {
        prop: 'editServiceModal',
        value: (row: EpinioServiceModel) => () => {
          serviceModal.value?.openEdit(row);
        },
        conditionFn: () => canEditService.value,
      }
    ];

  const processedRows = overrideTableRows(filtered, overrideProps);
  displayRows.value = processedRows;
})

onMounted(() => {
  store.dispatch('epinio/me');
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.NAMESPACE });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CATALOG_SERVICE });
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

function handleDeleted() {
  store.$router.push({
    name: 'epinio-c-cluster-resource',
    params: {
      ...store.$router.currentRoute.params,
      resource: 'catalogservices',
    },
  });
}
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
        <trailhand-action-menu 
          v-if="availableActions.length > 0 && canEditCatalogService"
          :actions="availableActions"
        />
        <div v-else></div>
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
    <ServiceDeleteModal ref="serviceDeleteModal" />
    <ServiceInstanceModal ref="serviceModal" />
    <CatalogServiceModal ref="catalogServiceModal" />
    <CatalogServiceDeleteModal ref="catalogServiceDeleteModal" @deleted="handleDeleted" />
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
