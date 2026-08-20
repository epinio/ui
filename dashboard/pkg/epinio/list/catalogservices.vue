<script setup lang="ts">
import { useStore } from 'vuex'
import { ref, computed, onMounted, watch } from 'vue'
import { useCatalogServices } from '../queries/useCatalogServicesQueries';
import Masthead from '@shell/components/ResourceList/Masthead';

import { EPINIO_TYPES } from '../types'

import CatalogServiceModal from '../components/service/CatalogServiceModal.vue';
import CatalogServiceDeleteModal from '../components/service/CatalogServiceDeleteModal.vue';
import { debounce } from 'lodash';
import { ListResourceRequestParams } from '../models/resource/ui-types';
import { ResourceTableRow } from '../models/resource/ui-types';
import { CatalogService } from '../models/catalogservice/ui-types';
import { createEpinioRoute } from '../utils/custom-routing';

const store = useStore()
const props = defineProps<{ schema: object }>(); // eslint-disable-line @typescript-eslint/no-unused-vars

const catalogServiceModal = ref<InstanceType<typeof CatalogServiceModal> | null>(null);
const deleteModal = ref<InstanceType<typeof CatalogServiceDeleteModal> | null>(null);

const resource: string = EPINIO_TYPES.CATALOG_SERVICE;

const requestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 9,
  search: '',
});

const searchQuery = ref<string>('');

watch(searchQuery, (newQuery) => {
  onSearch(newQuery);
});

const onSearch = debounce(async (query: string) => {
  requestParams.value.page = 1;
  requestParams.value.search = query;
}, 500);

const {data: catalogServices, isLoading: isLoadingCatalogServices, isError: isErrorCatalogServices, error: catalogServicesError} = useCatalogServices(store, requestParams);

const canEdit = computed(() => {
  const can = store.getters['epinio/can'];

  return can && (can('catalog_service_write') || can('catalog_service'));
});
const canDelete = canEdit;
const canCreate = canEdit;

onMounted(async () => {
  await store.dispatch('epinio/me');
});

const list = computed(() => {
  if (!catalogServices.value) {
    return [];
  }
  
  // Add custom namespace delete action to replace the built in rancher shell flow.
  // Gate by namespace write perms so view-only / app-only roles don't see Delete.
  const rows: ResourceTableRow<CatalogService>[] = (catalogServices.value.items ?? []).map((s) => ({
    ...s,
    id: s.meta.name, // stable, unique per namespace
    availableActions: [{
      label: 'Delete',
      action: () => openDeleteModal(s),
      enabled: canDelete.value,
      visible: canDelete.value,
      danger: true,
    }, {
      label: 'Edit',
      action: () => openEditModal(s),
      enabled: canEdit.value,
      visible: canEdit.value,
    }],
    canDelete: canDelete.value,
  }));
  return rows;
});

function openDeleteModal(catalogService: CatalogService) {
  deleteModal.value?.openDelete(catalogService);
}

function openEditModal(catalogService: CatalogService) {
  catalogServiceModal.value?.openEdit(catalogService);
}

const showDetails = (catalogService: CatalogService) => {
  const route = createEpinioRoute('c-cluster-resource-id', {
    cluster:   store.getters['clusterId'],
    resource:  resource,
    id: catalogService.meta.name,
  });
  store.$router.push(route);
}
</script>

<template>
  <div id="modal-container-element">
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

    <div v-if="isLoadingCatalogServices" class="flex justify-center items-center h-64">
      <trailhand-loading-spinner />
    </div>
    <div v-else class="cards-container" >
      <trailhand-card
        v-for="service in list"
        :key="service.id"
        :card-title="service.meta.name"
        :description="service.shortDescription"
        :icon-src="service.serviceIcon ? service.serviceIcon : null"
        :icon-name="service.serviceIcon ? null : 'database'"
        clickable
        @click="showDetails(service)"
      >
        <div slot="title" class="card-title">
          <h3>{{ service.meta.name }}</h3>
          <trailhand-action-menu
            v-if="service.availableActions && service.availableActions.length > 0"
            :actions="service.availableActions"
          />
        </div>
      </trailhand-card>
    </div>
  </div>
  <trailhand-pagination
    v-if="catalogServices && catalogServices.totalItems > 0"
    :current-page="catalogServices.page"
    :total-pages="catalogServices.totalPages"
    :show-info="false"
    :start-item="(catalogServices.page - 1) * catalogServices.pageSize + 1"
    :end-item="Math.min(catalogServices.page * catalogServices.pageSize, catalogServices.totalItems)"
    :total-items="catalogServices.totalItems"
    @page-change="(e) => requestParams.page = e.detail.page"
  />
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
