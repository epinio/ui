<script setup lang="ts">
import { ref, onMounted, useAttrs, computed } from 'vue';

import { EPINIO_TYPES } from '../types';
import Loading from '@shell/components/Loading';
import { useStore } from 'vuex';
import ResourceTable from '@shell/components/ResourceTable';

const pending = ref(true);
const store = useStore();
const attrs = useAttrs();

onMounted(async () => {
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP });
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  pending.value = false;
});

const rows = computed(() => {
  console.log(EPINIO_TYPES.SERVICE_INSTANCE);
  return store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE);
});
</script>
<template>
  <Loading v-if="pending" />
  <div v-else>
    <ResourceTable
      v-bind="attrs"
      :rows="rows"
    >
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

