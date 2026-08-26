<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { computed, ref, onMounted, watch } from 'vue';
import { useBuilderImages } from '../queries/useBuilderImagesQueries';
import Masthead from '@shell/components/ResourceList/Masthead';
import { debounce } from 'lodash';
import ImageModal from '../components/images/ImageModal.vue';
import { makeActionMenu } from '../utils/table-formatters';
import ImageDeleteModal from '../components/images/ImageDeleteModal.vue';
import { ResourceQueryOptions, ListResourceRequestParams, ResourceTableRow } from '../models/resource/ui-types';
import { BuilderImage } from '../models/builderimage/ui-types';


defineProps<{ schema: object }>(); // Keep for compatibility

const store = useStore();

const imageModal = ref<InstanceType<typeof ImageModal> | null>(null);
const deleteModal = ref<InstanceType<typeof ImageDeleteModal> | null>(null);

const resource: string = EPINIO_TYPES.BUILDER_IMAGE;

const requestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 9,
  search: '',
});

const requestOptions = ref<ResourceQueryOptions>({
  enabled: true,
  polling: true,
});

const searchQuery = ref<string>('');

watch(searchQuery, (newQuery) => {
  onSearch(newQuery);
});

const onSearch = debounce(async (query: string) => {
  requestParams.value.page = 1;
  requestParams.value.search = query;
}, 500);

const {data: builderImages, isLoading: isLoadingBuilderImages, isError: isErrorBuilderImages, error: builderImagesError} = useBuilderImages(store, requestParams, requestOptions);

const canEdit = computed(() => {
  const can = store.getters['epinio/can'];

  return can && (can('builderimage_write'));
});
const canDelete = canEdit;
const canCreate = canEdit;

const openDeleteModal = (builderImage: BuilderImage) => {
  deleteModal.value?.openDelete(builderImage);
};

const openEditModal = (builderImage: BuilderImage) => {
  imageModal.value?.openEdit(builderImage);
};

const displayRows = computed(() => {
  if (!builderImages.value) {
    return [];
  }
  
  const rows: ResourceTableRow<BuilderImage>[] = (builderImages.value.items ?? []).map((bi) => ({
    ...bi,
    id: bi.meta.name,
    availableActions: [{
      label: 'Delete',
      action: () => openDeleteModal(bi),
      enabled: canDelete.value && !bi.default,
      visible: canDelete.value && !bi.default,
      danger: true,
    }, {
      label: 'Edit',
      action: () => openEditModal(bi),
      enabled: canEdit.value,
      visible: canEdit.value,
    }],
    canDelete: canDelete.value,
  }));
  return rows;
});

onMounted(async () => {
  store.dispatch('epinio/me');
});

const columns = [
  {
    field: 'meta.name',
    label: 'Name'
  },
  {
    field: 'description',
    label: 'Description'
  },
  {
    field: 'image',
    label: 'Image'
  },
  {
    field:     'meta.createdAt',
    label:     'Age',
    formatter: 'age'
  }
];
</script>

<template>
  <div id="modal-container-element">
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template #createButton>
        <trailhand-button
          v-if="canCreate"
          variant="primary"
          size="large"
          @button-click="imageModal?.openCreate()"
        >
          {{ t('generic.create') }}
        </trailhand-button>
        <div v-else></div>
      </template>
    </Masthead>
    <Banner
      v-if="isErrorBuilderImages"
      color="error"
      :label="builderImagesError?.message || t('epinio.builderImages.errors.fetch')"
    /> 
    <div class="search-container">
      <trailhand-text-input
        :value="searchQuery"
        placeholder="Search..."
        @text-input-change="(e: CustomEvent) => searchQuery = e.detail.value"
      ></trailhand-text-input>
    </div>
    <trailhand-table
      :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
      :rows="displayRows"
      :columns="columns"
      :searchable="false"
      :total-items="builderImages?.totalItems ?? 0"
      :current-page="requestParams.page"
      :loading="isLoadingBuilderImages"
      key-field="id"
      @page-change="(e: CustomEvent) => { requestParams.page = e.detail.page; }"
    />
  </div>
  <ImageModal ref="imageModal" />
  <ImageDeleteModal ref="deleteModal" />
</template>

<style lang="scss" scoped>
.search-container {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}

</style>
