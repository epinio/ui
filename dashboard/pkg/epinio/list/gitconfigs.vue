<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { computed, ref, watch } from 'vue';
import { debounce } from 'lodash';
import { makeActionMenu } from '../utils/table-formatters';
import GitConfigModal from '../components/gitconfigs/GitConfigModal.vue';
import GitConfigDeleteModal from '../components/gitconfigs/GitConfigDeleteModal.vue';
import { ListResourceRequestParams, ResourceQueryOptions, ResourceTableRow } from '../models/resource/ui-types';
import { useGitConfigs } from '../queries/useGitConfigQueries';
import { GitConfig } from '../models/gitconfig/ui-types';
import { useUser } from '../queries/useUserQueries';
import Banner from '@components/Banner/Banner.vue';

defineProps<{ schema: object }>(); // Keep for compatibility

const store = useStore();

const gitConfigModal = ref<InstanceType<typeof GitConfigModal> | null>(null);
const gitConfigDeleteModal = ref<InstanceType<typeof GitConfigDeleteModal> | null>(null);

const resource: string = EPINIO_TYPES.GIT_CONFIG;

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

const {data: gitConfigs, isLoading: isLoadingGitConfigs, isError: isErrorGitConfigs, error: gitConfigsError} = useGitConfigs(store, requestParams, requestOptions);

const canEdit = computed(() => {
  return user.value?.permissions?.gitconfig_write || user.value?.permissions?.gitconfig;  
});
const canDelete = canEdit;
const canCreate = canEdit;

const openCreateModal = () => {
  gitConfigModal.value?.openCreate();
};

const openDeleteModal = (gitConfig: GitConfig) => {
  gitConfigDeleteModal.value?.openDelete(gitConfig);
};


const displayRows = computed(() => {
  if (!gitConfigs.value) {
    return [];
  }

  const rows: ResourceTableRow<GitConfig>[] = (gitConfigs.value.items ?? []).map((gc) => ({
    ...gc,
    id: gc.meta.name,
    availableActions: [{
      label: 'Delete',
      action: () => openDeleteModal(gc),
      enabled: canDelete.value,
      visible: canDelete.value,
      danger: true,
    }],
    canDelete: canDelete.value,
  }));
  return rows;
});

const columns = [
  {
    field: 'meta.name',
    label: 'Name'
  },
  {
    field: 'provider',
    label: 'Provider',
    formatter: 'gitProviders'
  },
  {
    field: 'url',
    label: 'URL'
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
      <h1>Git Configs</h1>
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
      v-if="isErrorGitConfigs"
      color="error"
      :label="gitConfigsError?.message || t('epinio.gitconfigs.errors.fetch')"
    />  
    <trailhand-table
      :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
      :rows="displayRows"
      :columns="columns"
      :server-side="true"
      :searchable="false"
      :total-items="gitConfigs?.totalItems ?? 0"
      :current-page="requestParams.page"
      :loading="isLoadingGitConfigs"
      key-field="id"
      @page-change="(e: CustomEvent) => { requestParams.page = e.detail.page; }"
    />
  </div>
  <GitConfigModal ref="gitConfigModal" />
  <GitConfigDeleteModal ref="gitConfigDeleteModal" />
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
