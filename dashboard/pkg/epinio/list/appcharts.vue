<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { computed, ref, watch } from 'vue';
import { debounce } from 'lodash';
import ChartsModal from '../components/charts/ChartsModal.vue';
import { makeActionMenu } from '../utils/table-formatters';
import ChartsDeleteModal from '../components/charts/ChartsDeleteModal.vue';
import { useAppCharts } from '../queries/useAppChartsQueries';
import { ListResourceRequestParams, ResourceQueryOptions, ResourceTableRow } from '../models/resource/ui-types';
import { AppChart } from '../models/appcharts/ui-types';
import Banner from '@components/Banner/Banner.vue';
import { useUser } from '../queries/useUserQueries';

defineProps<{ schema: object }>(); // Keep for compatibility

const store = useStore();

const chartsModal = ref<InstanceType<typeof ChartsModal> | null>(null);
const deleteModal = ref<InstanceType<typeof ChartsDeleteModal> | null>(null);

const resource: string = EPINIO_TYPES.APP_CHARTS;

const { data: user, isError: isErrorUser, error: userError } = useUser(store);

const requestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 10,
  search: '',
});

const requestOptions = ref<ResourceQueryOptions>({
  enabled: true,
  polling: true,
  isTablePagination: true,
});

const searchQuery = ref<string>('');

watch(searchQuery, (newQuery) => {
  onSearch(newQuery);
});

const onSearch = debounce(async (query: string) => {
  requestParams.value.page = 1;
  requestParams.value.search = query;
}, 500);

const {data: appCharts, isLoading: isLoadingAppCharts, isError: isErrorAppCharts, error: appChartsError} = useAppCharts(store, requestParams, requestOptions);

const canEdit = computed(() => {
  return user.value?.permissions?.chart_write;
});
const canDelete = canEdit;
const canCreate = canEdit;

const openCreateModal = () => {
  chartsModal.value?.openCreate();
};

const openDeleteModal = (appChart: AppChart) => {
  deleteModal.value?.openDelete(appChart);
};

const openEditModal = (appChart: AppChart) => {
  chartsModal.value?.openEdit(appChart);
};

const displayRows = computed(() => {
  if (!appCharts.value) {
    return [];
  }

  const rows: ResourceTableRow<AppChart>[] = (appCharts.value.items ?? []).map((ac) => ({
    ...ac,
    id: ac.meta.name, // stable, unique per namespace
    availableActions: [
      {
        label: 'Edit',
        action: () => openEditModal(ac),
        enabled: canEdit.value,
        visible: canEdit.value,
      },
      {
        label: 'Delete',
        action: () => openDeleteModal(ac),
        enabled: canDelete.value,
        visible: canDelete.value,
        danger: true,
      },
    ],
    canDelete: canDelete.value,
  }));
  return rows;
});

const columns = [
  {
    field: 'nameDisplay',
    label: 'Name',
    formatter: (_v: any, row: AppChart) => {
      const el = document.createElement('a');

      el.textContent = row.meta?.name || '';
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        chartsModal.value?.openView(row, !!canEdit.value);
      });

      return el;
    }
  },
  {
    field: 'description',
    label: 'Description'
  },
  {
    field: 'helmChart',
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
    <div class="heading">
      <h1>Application Charts</h1>
      <div class="actions">
        <trailhand-button
          v-if="canCreate"
          variant="primary"
          @click="openCreateModal()"
        >
          {{ t('generic.create') }}
        </trailhand-button>
        <trailhand-text-input
          :value="searchQuery"
          placeholder="Search..."
          @text-input-change="(e: CustomEvent) => searchQuery = e.detail.value"
        ></trailhand-text-input>
      </div>
    </div>
    <Banner
      v-if="isErrorUser"
      color="error"
      :label="userError?.message || t('epinio.user.errors.fetch')"
    />
    <Banner
      v-if="isErrorAppCharts"
      color="error"
      :label="appChartsError?.message || t('epinio.appCharts.errors.fetch')"
    />
    <trailhand-table
      :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
      :rows="displayRows"
      :columns="columns"
      :server-side="true"
      :searchable="false"
      :total-items="appCharts?.totalItems ?? 0"
      :current-page="requestParams.page"
      :loading="isLoadingAppCharts"
      key-field="id"
      @page-change="(e: CustomEvent) => { requestParams.page = e.detail.page; }"
    />
  </div>
  <ChartsModal ref="chartsModal" />
  <ChartsDeleteModal ref="deleteModal" />
</template>

<style lang="scss" scoped>
.heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 1rem;

  h1 {
    margin: 0;
  }
}

.actions {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
}

trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}

</style>
