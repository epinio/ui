<script setup lang="ts">
import '@krumio/trailhand-ui/data-table';
import '@krumio/trailhand-ui/action-menu';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { ref, onMounted, nextTick, watch } from 'vue';

import EpinioCatalogServiceModel from '../models/catalogservices';
import { EPINIO_TYPES } from '../types';

import type { DataTableColumn } from '../components/tables/types';
import { createDataTable, setupActionListener, setupNavigationListener, createLinkResolver } from '../utils/table-helpers';

const store = useStore();
const router = useRouter();

const t = store.getters['i18n/t'];

const props = defineProps<{ value: EpinioCatalogServiceModel }>();

const pending = ref<boolean>(true);
const tableContainer = ref<HTMLElement | null>(null);

onMounted(async () => {
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  pending.value = false;

  await nextTick();
  createOrUpdateTable();
});

// Watch for changes to the services
watch(() => props.value.services, async () => {
  await nextTick();
  createOrUpdateTable();
}, { deep: true });

// Custom formatters
const formatBoundApps = (_value: any, row: any) => {
  if (row.applications && row.applications.length) {
    return row.applications
      .map((app: any) => app.meta.name)
      .join(', ');
  }
  return '-';
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
    field: 'catalog_service',
    label: 'Catalog Service',
    sortable: false,
    link: createLinkResolver(router, 'serviceLocation')
  },
  {
    field: 'catalog_service_version',
    label: 'Catalog Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false,
    formatter: formatBoundApps
  },
  {
    field: 'metadata.created_at',
    label: 'Age',
    formatter: 'age'
  }
];

// Create and update table
const createOrUpdateTable = () => {
  if (!tableContainer.value || pending.value) return;

  tableContainer.value.innerHTML = '';

  const tableElement = createDataTable(columns, props.value.services || []);
  setupActionListener(tableElement);
  setupNavigationListener(tableElement, router);
  tableContainer.value.appendChild(tableElement);
};
</script>

<template>
  <div>
    <h2 class="mt-20">
      {{ t('epinio.catalogService.detail.servicesTitle', { catalogService: props.value.name }) }}
    </h2>
    <div v-if="pending">Loading...</div>
    <div v-else ref="tableContainer"></div>
  </div>
</template>
