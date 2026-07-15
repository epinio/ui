<script setup lang="ts">
import { useStore } from 'vuex'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Masthead from '@shell/components/ResourceList/Masthead';

import { EPINIO_TYPES } from '../types'

import Loading from '@shell/components/Loading.vue'
import { startPolling, stopPolling } from '../utils/polling';

import CatalogServiceModal from '../components/service/CatalogServiceModal.vue';
import CatalogServiceDeleteModal from '../components/service/CatalogServiceDeleteModal.vue';
import EpinioCatalogServiceModel from '../models/catalogservices';
import { overrideTableRows } from '../utils/table-formatters';

const store = useStore()
const props = defineProps<{ schema: object }>(); // eslint-disable-line @typescript-eslint/no-unused-vars

const pending = ref(true);
const searchQuery = ref(null);

const catalogServiceModal = ref<InstanceType<typeof CatalogServiceModal> | null>(null);
const deleteModal = ref<InstanceType<typeof CatalogServiceDeleteModal> | null>(null);

const resource: string = EPINIO_TYPES.CATALOG_SERVICE;

const canEdit = computed(() => {
  const can = store.getters['epinio/can'];

  return can && (can('service_write'));
});
const canDelete = canEdit;
const canCreate = canEdit;

onMounted(async () => {
  store.dispatch('epinio/me');
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.CATALOG_SERVICE });
  pending.value = false;

  startPolling(["namespaces", "applications", "catalogservices", "services"], store);
});

onUnmounted(() => {
  stopPolling(["namespaces", "applications", "catalogservices", "services"]);
});

const list = computed(() => {
  const catalogList = store.getters['epinio/all'](EPINIO_TYPES.CATALOG_SERVICE)

  // filter empty catalog services that are added during delete
  const filteredList = catalogList.filter((service: EpinioCatalogServiceModel) => service.meta.name !== '')

  const rowActions = (row: EpinioCatalogServiceModel) => {
    const out: any[] = [];

    if (canEdit.value) {
      out.push({
        label: 'Edit',
        enabled: true,
        action: () => catalogServiceModal.value?.openEdit(row),

      });
    }
    if (canDelete.value) {
      out.push({
        enabled: true,
        label: 'Delete',
        action: () => deleteModal.value?.openDelete(row),
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
  ];

  const processedList = overrideTableRows(filteredList, overrideProps);

  if (!searchQuery.value) {
    return processedList;
  } else {
    const query = searchQuery.value.toLowerCase();

    return processedList.filter((e) => e?.chart.toLowerCase().includes(query) ||
      e?.description.toLowerCase().includes(query) ||
      e?.short_description.toLowerCase().includes(query));
  }
})

const showDetails = (chart: any) => {
  store.$router.push(chart.detailLocation)
}

</script>

<template>
  <Loading v-if="pending" />
  <div id="modal-container-element" v-else>
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      {{canCreate}}
      <template #createButton>
        <trailhand-button
          v-if="canCreate"
          variant="primary"
          size="large"
          @button-click="catalogServiceModal?.openCreate()"
        >
          {{ t('generic.create') }}
        </trailhand-button>
        <div v-else></div>
      </template>
    </Masthead>
    <div  class="filter-block">
      <trailhand-text-input
        v-model="searchQuery"
        type="search"
        class="input-sm"
        :placeholder="t('catalog.charts.search')"
      />
    </div>

    <div class="cards-container">
      <trailhand-card
        v-for="service in list"
        :key="service.id"
        :card-title="service.meta.name"
        :description="service.short_description"
        :icon-src="service.service_icon ? service.service_icon : null"
        :icon-name="service.service_icon ? null : 'database'"
        clickable
        @click="showDetails(service)"
      >
        <div slot="title" class="card-title">
          <h3>{{ service.meta.name }}</h3>
          <trailhand-action-menu
            v-if="service.availableActions.length > 0"
            :actions="service.availableActions"
          />
        </div>
      </trailhand-card>
    </div>
  </div>
  <CatalogServiceModal ref="catalogServiceModal" />
  <CatalogServiceDeleteModal ref="deleteModal" />
</template>

<style lang="scss" scoped>
.filter-block {
  display: flex;
  justify-content: flex-end;
  input {
    width: 315px;
  }
}

.cards-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (max-width: 992px) {
  .cards-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .cards-container {
    grid-template-columns: repeat(1, 1fr);
  }
}
</style>
