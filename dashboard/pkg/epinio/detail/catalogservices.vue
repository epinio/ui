<script setup lang="ts">
import '@krumio/trailhand-ui/Components/data-table.js';
import '@krumio/trailhand-ui/Components/action-menu.js';
import { useStore } from 'vuex';
import { ref, onMounted, nextTick, watch } from 'vue';

import EpinioCatalogServiceModel from '../models/catalogservices';
import { EPINIO_TYPES } from '../types';

import type { DataTableColumn } from '../components/tables/types';
import { createDataTable, setupActionListener } from '../utils/table-helpers';

const store = useStore();

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
const formatCatalogService = (value: any, row: any) => {
  if (row.serviceLocation) {
    const url = row.serviceLocation.detailLocation;
    return `<a href="${url}">${row.catalog_service}</a>`; // TODO: this is not displaying correctly as the web component does not render HTML inside cells
  }
  return row.catalog_service;
};

const formatBoundApps = (value: any, row: any) => {
  if (row.applications && row.applications.length) {
    return row.applications
      .map((app: any) => `<a href="${app.detailLocation}">${app.meta.name}</a>`)
      .join(', ');
  }
  return '<span class="text-muted">&nbsp;</span>'; // TODO: this is not displaying correctly as the web component does not render HTML inside cells
};

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
    field: 'metadata.namespace',
    label: 'Namespace'
  },
  {
    field: 'catalog_service',
    label: 'Service',
    sortable: false,
    formatter: formatCatalogService
  },
  {
    field: 'catalog_service_version',
    label: 'Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Apps',
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
