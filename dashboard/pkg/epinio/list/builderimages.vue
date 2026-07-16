<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { computed, ref, onMounted, onUnmounted, watchEffect, watch } from 'vue';
import Masthead from '@shell/components/ResourceList/Masthead';
import { startPolling, stopPolling } from '../utils/polling';
import { debounce } from 'lodash';
import ImageModal from '../components/images/ImageModal.vue';
import { makeActionMenu } from '../utils/table-formatters';
import { overrideTableRows } from '../utils/table-formatters';
import EpinioBuilderImageModel from '../models/builderimages';
import ImageDeleteModal from '../components/images/ImageDeleteModal.vue';


defineProps<{ schema: object }>(); // Keep for compatibility

const store = useStore();

const pending = ref(true);
const rows = ref<any[]>([]);

const imageModal = ref<InstanceType<typeof ImageModal> | null>(null);
const deleteModal = ref<InstanceType<typeof ImageDeleteModal> | null>(null);

const resource: string = EPINIO_TYPES.BUILDER_IMAGE;
const paginationMeta = computed(() => store.getters['epinio/paginationMeta'](resource));
const currentPage = computed(() => store.getters['epinio/currentPaginationPage'](resource));

const searchQuery = ref<string>('');

const paginating = ref(false);

const canEdit = computed(() => {
  const can = store.getters['epinio/can'];

  return can && (can('builderimage_write'));
});
const canDelete = canEdit;
const canCreate = canEdit;

async function goToPage(page: number) {
  const meta = paginationMeta.value;

  if (meta && (page < 1 || page > meta.totalPages)) return;
  paginating.value = true;
  try {
    await store.dispatch('epinio/goToPage', { type: resource, page });
  } finally {
    paginating.value = false;
  }
}

const onSearch = debounce(async (query: string) => {
  paginating.value = true;
  try {
    await store.dispatch('epinio/search', { type: resource, query });
  } finally {
    paginating.value = false;
  }
}, 500);

watch(searchQuery, (newQuery) => {
  onSearch(newQuery);
});

watchEffect(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.BUILDER_IMAGE) as any[];

  // Touch meta so _MERGE polling (which deletes/re-adds all properties) re-runs this effect
  all.forEach((row: any) => { void row.meta; });

  // Filter empty rows that are added during delete
  const filtered = all.filter((row) => {
    if (!row.id) return false;
    else return true;
  });

  // Build the row action menu with RBAC gating. The model already gates the
  // base actions; here we inject the modal-driven Edit/Delete entries only
  // when the user has builder image write permissions.
  const rowActions = (row: EpinioBuilderImageModel) => {
    const out: any[] = [];

    if (canEdit.value) {
      out.push({
        action: 'editBuilderImage',
        label: 'Edit',
        enabled: true
      });
    }
    if (canDelete.value && !row.default) {
      out.push({
        action: 'removeBuilderImage',
        enabled: true,
        label: 'Delete',
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
    {
      prop: 'removeBuilderImage',
      value: (row: EpinioBuilderImageModel) => () => {
        deleteModal.value?.openDelete(row);
      },
      conditionFn: (row: EpinioBuilderImageModel) => canDelete.value && !row.default,
    },
    {
      prop: 'editBuilderImage',
      value: (row: EpinioBuilderImageModel) => () => {
         imageModal.value?.openEdit(row);
      },
      conditionFn: (row: EpinioBuilderImageModel) => canEdit.value,
    }
  ];

  const processedRows = overrideTableRows(filtered, overrideProps);

  rows.value = [...processedRows];
});

onMounted(async () => {
  store.dispatch('epinio/me');
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.BUILDER_IMAGE });
  pending.value = false;
  startPolling(['builderimages'], store);
});

onUnmounted(() => {
  stopPolling(['builderimages']);
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
    <div class="search-container">
      <trailhand-text-input
        :value="searchQuery"
        placeholder="Search..."
        @text-input-change="(e: CustomEvent) => searchQuery = e.detail.value"
      ></trailhand-text-input>
    </div>
    <trailhand-table
      :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
      :rows="rows"
      :columns="columns"
      :searchable="false"
      :server-side="!!paginationMeta"
      :total-items="paginationMeta?.totalItems ?? rows.length"
      :current-page="currentPage"
      :loading="pending || paginating"
      key-field="id"
      @page-change="(e: CustomEvent) => goToPage(e.detail.page)"
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
