<script setup lang="ts">
import { useStore } from 'vuex';
import { ref, computed, onMounted } from 'vue';

import EpinioCatalogServiceModel from '../models/catalogservices';
import { EPINIO_PRODUCT_NAME, EPINIO_TYPES } from '../types';

import ResourceTable from '@shell/components/ResourceTable.vue';

const store = useStore();

const t = store.getters['i18n/t'];

const props = defineProps<{ value: EpinioCatalogServiceModel }>(); // eslint-disable-line @typescript-eslint/no-unused-vars

const pending = ref<boolean>(true);

onMounted(async () => {
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  pending.value = false;
});

const servicesSchema = computed(() => {
  return store.getters[`${ EPINIO_PRODUCT_NAME }/schemaFor`](EPINIO_TYPES.SERVICE_INSTANCE);
});

const servicesHeaders = computed(() => {
  return store.getters['type-map/headersFor'](servicesSchema.value);
});
</script>

<template>
  <div>
    <h2 class="mt-20">
      {{ t('epinio.catalogService.detail.servicesTitle', { catalogService: value.name }) }}
    </h2>
    <ResourceTable
      :schema="servicesSchema"
      :rows="value.services"
      :loading="pending"
      :headers="servicesHeaders"
    >
      <template #cell:boundApps="{ row }">
        <span v-if="row.applications.length">
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

    </ResourceTable>
  </div>
</template>
