<script setup lang="ts">
import { useStore } from 'vuex';
import { ref, onMounted, computed, watchEffect, watch } from 'vue';
import { EPINIO_TYPES } from '../types';
import Masthead from '@shell/components/ResourceList/Masthead';
import { attachActionMenu } from '../utils/table-formatters';
import { debounce } from 'lodash';
import { useNamespaces } from '../queries/useNamespaceQueries';
import { ListNamespacesRequestParams, Namespace } from '../models/namespace/types';
import NamespaceModal from '../components/namespace/NamespaceModal.vue';
import NamespaceDeleteModal from '../components/namespace/NamespaceDeleteModal.vue';
import Banner from '@components/Banner/Banner.vue';
import { ResourceTableRow } from 'models/resource/types';

defineProps<{
  schema: object,
  rows: Array<Namespace>,
}>();

const store = useStore() as any;
const t = store.getters['i18n/t'];

const resource: string = EPINIO_TYPES.NAMESPACE;
const displayRows = ref<ResourceTableRow[]>([]);

const namespaceModal = ref<InstanceType<typeof NamespaceModal> | null>(null);
const namespaceDeleteModal = ref<InstanceType<typeof NamespaceDeleteModal> | null>(null);

const requestParams = ref<ListNamespacesRequestParams>({
  page: 1,
  pageSize: 10,
  search: ''
});

const searchQuery = ref<string>('');

watch(searchQuery, (newQuery) => {
  onSearch(newQuery);
});

const onSearch = debounce(async (query: string) => {
  requestParams.value.page = 1;
  requestParams.value.search = query;
}, 500);

const {data: namespaces, isLoading: isLoadingNamespaces, isError: isErrorNamespaces, error: namespacesError} = useNamespaces(store, requestParams);

// Strict RBAC: only show Create/Delete when the user has namespace write perms (admin).
// Defined ahead of the watchEffect that consumes them to avoid a TDZ on first run.
const canCreateNamespace = computed(() => {
  const can = store.getters['epinio/can'];
  const perms = store.getters['epinio/permissions']?.();

  if (!can || !perms || Object.keys(perms).length === 0) {
    return false;
  }

  // Create is cluster-scoped: gate on the global-only namespace_create.
  return can('namespace_create');
});
// Per-namespace delete is namespaced (server authorizes it against the role for
// the namespace being deleted), so it stays on the flat namespace_write and is
// further gated per-row by row.canDelete below.
const canDelete = computed(() => {
  const can = store.getters['epinio/can'];
  const perms = store.getters['epinio/permissions']?.();

  if (!can || !perms || Object.keys(perms).length === 0) {
    return false;
  }

  return can('namespace_write') || can('namespace');
});

watchEffect(() => {
  if (!namespaces.value) {
    displayRows.value = [];
    return;
  }
  // Add custom namespace delete action to replace the built in rancher shell flow.
  // Gate by namespace write perms so view-only / app-only roles don't see Delete.

  const rows: ResourceTableRow[] = (namespaces.value.items ?? []).map((n) => ({
    ...n,
    id: n.meta.name, // stable, unique per namespace
    availableActions: [{
      label: 'Delete',
      action: () => openDeleteModal(n),
      enabled: canDelete.value,
      visible: canDelete.value,
      danger: true,
    }]
  }));
  displayRows.value = rows;
});


onMounted(() => {
  store.dispatch('epinio/me');

  // Opens the create namespace modal if the query is passed as query param
  if (store.$router.currentRoute._value.query.mode === 'openModal') {
    openCreateModal();
  }
});

async function openCreateModal() {
  namespaceModal.value?.openCreate();
}

function openDeleteModal(namespace: Namespace) {
  namespaceDeleteModal.value?.openDelete(namespace);
}

const columns = [
  {
    field: 'meta.name',
    label: t('epinio.namespace.name'),
  },
  {
    field: 'appCount',
    label: t('epinio.namespace.tableHeaders.appCount'),
    formatter: (_v: any, row: Namespace) => {
      return row.apps?.length || 0;
    }
  },
  {
    field: 'configCount',
    label: t('epinio.namespace.tableHeaders.configCount'),
    formatter: (_v: any, row: Namespace) => {
      return row.configurations?.length || 0;
    }
  },
  {
    field: 'meta.createdAt',
    label: t('epinio.namespace.tableHeaders.age'),
    formatter: 'age'
  }
];
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<!--
  trailhand-modal is a Web Component, not a Vue component. The HTML standard
  slot="x" attribute is correct here.
-->
<template>
  <div id="modal-container-element">
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template #createButton>
        <trailhand-button
          v-if="canCreateNamespace"
          variant="primary"
          size="large"
          @click="openCreateModal"
        >
          {{ t('generic.create') }}
        </trailhand-button>
        <div v-else></div>
      </template>
    </Masthead>
    <div class="search-container">
      <trailhand-text-input
        :value="searchQuery"
        :placeholder="t('generic.search')"
        @text-input-change="(e: CustomEvent) => searchQuery = e.detail.value"
      ></trailhand-text-input>
    </div>
    <Banner
      v-if="isErrorNamespaces"
      color="error"
      :label="namespacesError?.message || t('epinio.namespace.errors.fetch')"
    />  
    <trailhand-table
      :ref="(el: any) => { if (el) el.renderActions = attachActionMenu; }"
      :rows="displayRows"
      :columns="columns"
      :server-side="true"
      :total-items="namespaces?.totalItems ?? 0"
      :current-page="requestParams.page"
      :loading="isLoadingNamespaces"
      :searchable="false"
      key-field="id"
      @page-change="(e: CustomEvent) => { requestParams.page = e.detail.page; }"
    />
    <NamespaceModal ref="namespaceModal"/>
    <NamespaceDeleteModal ref="namespaceDeleteModal"/>
  </div>
</template>

<style lang='scss' scoped>
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

