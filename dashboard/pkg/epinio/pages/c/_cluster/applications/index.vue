<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

import ResourceTable from '@shell/components/ResourceTable';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import LinkDetail from '@shell/components/formatter/LinkDetail';

import { EPINIO_TYPES } from '../../../../types';
import { createEpinioRoute } from '../../../../utils/custom-routing';

const store = useStore();
const router = useRouter();

const resource = EPINIO_TYPES.APP;
const schema = ref(store.getters['epinio/schemaFor'](resource));

const headers = computed(() => store.getters['type-map/headersFor'](schema.value));
const groupBy = computed(() => store.getters['type-map/groupByFor'](schema.value));
const createLocation = computed(() =>
  createEpinioRoute('c-cluster-applications-createapp', { cluster: store.getters['clusterId'] })
);

const openCreateRoute = () => {
  router.push(createLocation.value);
};

const rows = computed(() => store.getters['epinio/all'](resource));

const pending = ref(true);

onMounted(async () => {
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP });
  // Non-blocking fetch
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });

  pending.value = false;
});
</script>

<template>
  <Loading v-if="pending" />
  <div v-else>
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template #createButton>
        <button
          class="btn role-primary"
          @click="openCreateRoute"
        >
          {{ t('generic.create') }}
        </button>
      </template>
    </Masthead>

    <ResourceTable
      :schema="schema"
      :rows="rows"
      :headers="headers"
      :group-by="groupBy"
    >
      <template #cell:configurations="{ row }">
        <span v-if="row.baseConfigurations.length">
          <template
            v-for="(configuration, index) in row.baseConfigurations"
            :key="configuration.id"
          >
            <LinkDetail
              :row="configuration"
              :value="configuration.meta.name"
            />
            <span v-if="index !== row.baseConfigurations.length - 1">, </span>
          </template>
        </span>
        <span v-else class="text-muted">&nbsp;</span>
      </template>

      <template #cell:services="{ row }">
        <span v-if="row.services.length">
          <template
            v-for="(service, index) in row.services"
            :key="service.id"
          >
            <LinkDetail
              :row="service"
              :value="service.meta.name"
            />
            <span v-if="index !== row.services.length - 1">, </span>
          </template>
        </span>
        <span v-else class="text-muted">&nbsp;</span>
      </template>

      <template #cell:route="{ row }">
        <span v-if="row.routes.length" class="route">
          <template
            v-for="(route, index) in row.routes"
            :key="route.id || route"
          >
            <a
              v-if="row.state === 'running'"
              :href="`https://${route}`"
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              {{ `https://${route}` }}
            </a>
            <span v-else>
              {{ `https://${route}` }}
            </span>
            <span v-if="index !== row.routes.length - 1">, </span>
          </template>
        </span>
        <span v-else class="text-muted">&nbsp;</span>
      </template>
    </ResourceTable>
  </div>
</template>

<style lang="scss" scoped>
.route {
  word-break: break-word;
}
</style>
