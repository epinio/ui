<script setup lang="ts">
import { useStore } from 'vuex';
import { ref, onMounted } from 'vue';

import EpinioCatalogServiceModel from '../models/catalogservices';
import { EPINIO_TYPES } from '../types';

import DataTable from '../components/tables/DataTable.vue';
import type { DataTableColumn } from '../components/tables/types';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter.vue';
import LinkDetail from '@shell/components/formatter/LinkDetail.vue';

const store = useStore();

const t = store.getters['i18n/t'];

const props = defineProps<{ value: EpinioCatalogServiceModel }>();

const pending = ref<boolean>(true);

onMounted(async () => {
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  pending.value = false;
});

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
    field: 'catalog_service',
    label: 'Catalog Service',
    sortable: false
  },
  {
    field: 'catalog_service_version',
    label: 'Catalog Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];
</script>

<template>
  <div>
    <h2 class="mt-20">
      {{ t('epinio.catalogService.detail.servicesTitle', { catalogService: props.value.name }) }}
    </h2>
    <DataTable
      :rows="props.value.services"
      :columns="columns"
      :loading="pending"
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
      <template #cell:catalog_service="{ row }">
        <LinkDetail
          v-if="row.serviceLocation"
          :row="row.serviceLocation"
          :value="row.catalog_service"
        />
        <span v-else>{{ row.catalog_service }}</span>
      </template>
      <template #cell:boundApps="{ row }">
        <span v-if="row.applications && row.applications.length">
          <template v-for="(app, index) in row.applications" :key="app.id">
            <LinkDetail
              :row="app"
              :value="app.meta.name"
            />
            <span
              v-if="index < row.applications.length - 1"
              :key="app.id + 'i'"
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
</template>
