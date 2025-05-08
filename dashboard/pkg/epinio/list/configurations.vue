<script setup lang="ts">
import ResourceTable from '@shell/components/ResourceTable';
import { EPINIO_TYPES } from '../types';
import Loading from '@shell/components/Loading';

import { useStore } from 'vuex';
import { ref, reactive, computed, onMounted, watch, useAttrs } from 'vue';

const store = useStore();
const attrs = useAttrs();

const props = defineProps<{
  schema: object,
}>();

const pending = ref<boolean>(true);

onMounted(async () => {
  store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP });
  store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.CONFIGURATION });

  pending.value = false;
});

const rows = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.CONFIGURATION);
});
</script>

<template>
  <Loading v-if="pending" />
  <div v-else>
    <ResourceTable
      v-bind="attrs"
      :rows="rows"
      :schema="schema"
    >
      <template #cell:service="{ row }">
        <LinkDetail
          v-if="row.service"
          :key="row.service.id"
          :row="row.service"
          :value="row.service.meta.name"
        />
        <span
          v-else
          class="text-muted"
        >&nbsp;</span>
      </template>
      <template #cell:boundApps="{ row }">
        <span v-if="row.applications.length">
          <template :key="app.id" v-for="(app, index) in row.applications">
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
