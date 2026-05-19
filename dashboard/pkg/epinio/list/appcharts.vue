<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { computed, ref, onMounted, onUnmounted, watchEffect, watch } from 'vue';
import Masthead from '@shell/components/ResourceList/Masthead';
import { startPolling, stopPolling } from '../utils/polling';
import { debounce } from 'lodash';
import ChartsModal from '../components/charts/ChartsModal.vue';

defineProps<{ schema: object }>(); // Keep for compatibility

const store = useStore();

const pending = ref(true);
const rows = ref<any[]>([]);

const chartsModal = ref<InstanceType<typeof ChartsModal> | null>(null);
// const deleteModal = ref<InstanceType<typeof ServiceDeleteModal> | null>(null);

const resource: string = EPINIO_TYPES.APP_CHARTS;
const paginationMeta = computed(() => store.getters['epinio/paginationMeta'](resource));
const currentPage = computed(() => store.getters['epinio/currentPaginationPage'](resource));

const searchQuery = ref<string>('');

const paginating = ref(false);

// const canEdit = computed(() => {
//   const can = store.getters['epinio/can'];

//   return can && (can('service_write') || can('service'));
// });
const canEdit = true; // For now, until we have permissions in place
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
  const all = store.getters['epinio/all'](EPINIO_TYPES.APP_CHARTS) as any[];

  // Touch meta so _MERGE polling (which deletes/re-adds all properties) re-runs this effect
  all.forEach((row: any) => { void row.meta; });
  rows.value = [...all];
});

onMounted(async () => {
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP_CHARTS });
  pending.value = false;
  startPolling(['appcharts'], store);
});

onUnmounted(() => {
  stopPolling(['appcharts']);
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
    field: 'helm_chart',
    label: 'Helm Chart'
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
          @button-click="chartsModal?.openCreate()"
        >
          {{ t('generic.create') }}
        </trailhand-button>
        <div v-else />
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
  <ChartsModal ref="chartsModal" />
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
