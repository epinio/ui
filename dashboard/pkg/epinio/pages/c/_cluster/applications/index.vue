<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect, watch } from 'vue';
import { useStore } from 'vuex';
import { debounce } from 'lodash';
import { useRouter } from 'vue-router';
import Banner from '@components/Banner/Banner.vue';
import { EPINIO_TYPES } from '../../../../types';
import Masthead from '@shell/components/ResourceList/Masthead';
import {
  makeActionMenu,
  makeStateTag,
  makeAppRoutesCell,
  makeNameLinks,
} from '../../../../utils/table-formatters';
import AppModal from '../../../../components/application/AppModal.vue';
import AppDeleteModal from '../../../../components/application/AppDeleteModal.vue';
import BulkDeleteModal from '../../../../components/BulkDeleteModal.vue';
import ExportAppModal from '../../../../dialog/ExportAppModal.vue';
import { useApplications } from '../../../../queries/useApplicationQueries';
import { App } from '../../../../models/application/ui-types';
import { ListResourceRequestParams, ResourceQueryOptions, ResourceTableRow } from '../../../../models/resource/ui-types';
import { useUser } from '../../../../queries/useUserQueries';

const store = useStore() as any;
const t = store.getters['i18n/t'];
const router = useRouter();

const appModal = ref<InstanceType<typeof AppModal> | null>(null);
const deleteModal = ref<InstanceType<typeof AppDeleteModal> | null>(null);
const bulkDeleteModal = ref<InstanceType<typeof BulkDeleteModal> | null>(null);
const exportAppModal = ref<InstanceType<typeof ExportAppModal> | null>(null);
const deleteAppModal = ref<InstanceType<typeof AppDeleteModal> | null>(null);

const resource: string = EPINIO_TYPES.APP;
const schema = ref(store.getters['epinio/schemaFor'](resource));

const { data: user, isError: isErrorUser, error: userError } = useUser(store);

const requestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 10,
  search: '',
  namespaces: []
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

const {data: applications, isLoading: isLoadingApplications, isError: isErrorApplications, error: applicationsError} = useApplications(store, requestParams, requestOptions);

const tableEl = ref<any>(null);
const selectedRows = ref<any[]>([]);

const canCreate = computed(() => {
  return user.value?.permissions?.app_create || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canEdit = computed(() => {
  return user.value?.permissions?.app_update || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canDelete = computed(() => {
  return user.value?.permissions?.app_delete || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canExport = computed(() => {
  return user.value?.permissions?.app_export || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canExec = computed(() => {
  return user.value?.permissions?.app_exec  || user.value?.permissions?.app;
});
const canLogs = computed(() => {
  return user.value?.permissions?.app_logs || user.value?.permissions?.app;
});
const canStage = computed(() => {
  return user.value?.permissions?.app_stage || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canRestart = computed(() => {
  return user.value?.permissions?.app_restart || user.value?.permissions?.app_write || user.value?.permissions?.app;
});

const handleCreateClick = () => {
  appModal.value?.openCreate();
};

// Watch for changes to the active namespace cache and update the request params accordingly
watchEffect(() => {
  void store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;

  if (activeNamespaces && Object.keys(activeNamespaces).length > 0) {
    requestParams.value.namespaces = Object.keys(activeNamespaces);
  } else {
    requestParams.value.namespaces = undefined;
  }
});

// watchEffect(async () => {
//   const all = store.getters['epinio/all'](EPINIO_TYPES.APP) as any[];
//   all.forEach((row: any) => { void row.status; void row.stateDisplay; void row.meta; void row.boundapps; });

//   // Filter empty rows that are added during delete
//   const filtered = all.filter((row) => {
//     if (!row.id) return false;
//     return true;
//   });

//   const overrideProps = [
//     {
//       prop: 'availableActions',
//       value: (row: EpinioApplicationModel) => {
//         const actions = [...row.availableActions];
//         const goToEditIndex = actions.findIndex((a: any) => a.action === 'goToEdit');
//         const exportAppIndex = actions.findIndex((a: any) => a.action === 'exportApp');
//         const deleteAppIndex = actions.findIndex((a: any) => a.action === 'promptRemove');
//         const newEditAction = {
//           action: 'goToEdit',
//           label: 'Edit',
//           enabled: true
//         };
//         const newExportAction = {
//           action: 'exportApp',
//           label: 'Export',
//           enabled: true
//         };
//         const newDeleteAction = {
//           action: 'deleteApp',
//           label: 'Delete',
//           enabled: true
//         };
//         if (goToEditIndex !== -1 && canEdit.value) {
//           actions.splice(goToEditIndex, 1, newEditAction);
//         } else if (canEdit.value) {
//           actions.push(newEditAction);
//         } else if (goToEditIndex !== -1 && !canEdit.value) {
//           actions.splice(goToEditIndex, 1);
//         }

//         if (exportAppIndex !== -1) {
//           actions.splice(exportAppIndex, 1, newExportAction);
//         }

//         if (deleteAppIndex !== -1 && canEdit.value) {
//           actions.splice(deleteAppIndex, 1, newDeleteAction);
//         } else if (deleteAppIndex !== -1 && !canEdit.value) {
//           actions.splice(deleteAppIndex, 1);
//         }
//         return actions;
//       },
//       conditionFn: () => {
//         return true;
//       },
//     },
//     {
//       prop: 'goToEdit',
//       value: (row: EpinioApplicationModel) => () => {
//         appModal.value?.openEdit(row);
//       },
//       conditionFn: () => {
//         return true;
//       },
//     },
//     {
//       prop: 'exportApp',
//       value: (row: EpinioApplicationModel) => () => {
//         exportAppModal.value?.openExport([row]);
//       },
//       conditionFn: () => {
//         return true;
//       },
//     },
//     {
//       prop: 'deleteApp',
//       value: (row: EpinioApplicationModel) => () => {
//         deleteModal.value?.openDelete(row);
//       },
//       conditionFn: () => {
//         return true;
//       },
//     }
//   ];

//   const processedRows = overrideTableRows(filtered, overrideProps);

//   displayRows.value = [...processedRows];
// });

const openDeleteModal = (app: App) => {
  deleteModal.value?.openDelete(app);
};

const openEditModal = (app: App) => {
  appModal.value?.openEdit(app);
};

const displayRows = computed(() => {
  if (!applications.value) {
    return [];
  }
  
  const rows: ResourceTableRow<App>[] = (applications.value.items ?? []).map((a) => ({
    ...a,
    id: a.meta.name, // stable, unique per namespace
    availableActions: [{
      label: 'Delete',
      action: () => openDeleteModal(a),
      enabled: canDelete.value,
      visible: canDelete.value,
      danger: true,
    }, {
      label: 'Edit',
      action: () => openEditModal(a),
      enabled: canEdit.value,
      visible: canEdit.value,
    }],
    canDelete: canDelete.value,
  }));
  return rows;
});

onMounted(async () => {
  window.addEventListener('resize', onResize);

  const query = store.$router.currentRoute._value.query;

  if (query.mode === 'openModal') {
    appModal.value?.openCreate();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
});

// Services without service_write/service permission on that row can't be
// individually deleted, so they're excluded from bulk selection too.
const isRowSelectable = (row: any) => row.canDelete;

const handleSelectionChange = (event: CustomEvent) => {
  selectedRows.value = event.detail.selectedRows;
};

const handleBulkDeleteClick = () => {
  bulkDeleteModal.value?.openDelete(selectedRows.value);
};

const handleBulkDeleted = () => {
  selectedRows.value = [];
  tableEl.value?.clearSelection();
};

// NOTE: must be a named function declared here, not an inline arrow function
// in the template, see feedback_vue_ref_unwrap_bug.md. Vue auto-unwraps
// top-level refs inside template expressions, so referencing `tableEl`
// directly in an inline template callback gives the already-unwrapped
// (initially null) value instead of the Ref object, and `tableEl.value = el`
// throws, silently aborting the rest of the block.
const setTableRef = (el: any) => {
  if (el) {
    tableEl.value = el;
    el.renderActions = makeActionMenu;
    el.rowSelectable = isRowSelectable;
  }
};

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};

const windowWidth = ref(window.innerWidth);
const onResize = () => { windowWidth.value = window.innerWidth; };

const allColumns = [
  {
    field:     'stateDisplay',
    label:     'State',
    width:     '110px',
    formatter: (_value: string, row: App) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    width: '125px',
    formatter: (_value: any, row: App) => makeNameLinks(
      [row.meta.name],
      { cluster: store.getters['clusterId'], namespace: row.meta.namespace, resource: EPINIO_TYPES.APP },
      router
    )
  },
  {
    field: 'meta.namespace',
    label: 'Namespace',
    width: '125px',
  },
  { field: 'deployment.status', label: 'Status', width: '75px' },
  {
    field:     'route',
    label:     'Routes',
    width:     '180px',
    sortable:  false,
    formatter: (_value: any, row: App) => makeAppRoutesCell(row)
  },
  {
    field:     'boundConfigs',
    label:     'Bound Configs',
    width:     '180px',
    sortable:  false,
    formatter: (_value: any, row: App) => makeNameLinks(
      row.configuration?.configurations,
      { cluster: store.getters['clusterId'], namespace: row.meta.namespace, resource: EPINIO_TYPES.CONFIGURATION },
      router
    )
  },
  {
    field:     'boundServices',
    label:     'Bound Services',
    width:     '180px',
    sortable:  false,
    formatter: (_value: any, row: App) => makeNameLinks(
      row.configuration?.services,
      { cluster: store.getters['clusterId'], namespace: row.meta.namespace, resource: EPINIO_TYPES.SERVICE_INSTANCE },
      router
    )
  },
  { field: 'deployment.username', label: 'Last Deployed By', width: '150px' },
  { field: 'meta.createdAt',      label: 'Age',              width: '50px', formatter: 'age' }
];

const columns = computed(() => {
  const w = windowWidth.value;
  const hide = new Set<string>();

  if (w < 1900) hide.add('deployment.username');
  if (w < 1700) hide.add('deployment.status');
  if (w < 1600) { hide.add('boundConfigs'); hide.add('boundServices'); }
  if (w < 1150) hide.add('meta.createdAt');
  if (w < 875)  hide.add('route');

  return allColumns.filter(col => !hide.has(col.field));
});
</script>

<template>
  <div id="modal-container-element">
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template #extraActions>
        <trailhand-button
          v-if="selectedRows.length"
          variant="destructive"
          size="large"
          @click="handleBulkDeleteClick"
        >
          <trailhand-icon name="trash" />
          Delete ({{ selectedRows.length }})
        </trailhand-button>
      </template>
      <template #createButton>
        <trailhand-button
          v-if="canCreate"
          variant="primary"
          size="large"
          @click="handleCreateClick"
        >
          {{ t('generic.create') }}
        </trailhand-button>
        <div v-else />
      </template>
    </Masthead>
    <Banner
      v-if="isErrorUser"
      color="error"
      :label="userError?.message || t('epinio.user.errors.fetch')"
    />
    <Banner
      v-if="isErrorApplications"
      color="error"
      :label="applicationsError?.message || t('epinio.applications.errors.fetch')"
    />  
    <div class="search-container">
      <trailhand-text-input
        :value="searchQuery"
        placeholder="Search..."
        @text-input-change="(e: CustomEvent) => searchQuery = e.detail.value"
      ></trailhand-text-input>
    </div>
      <trailhand-table
        :ref="setTableRef"
        :rows="displayRows"
        :columns="columns"
        :searchable="false"
        :selectable="canDelete"
        :server-side="true"
        :total-items="applications?.totalItems ?? 0"
        :current-page="requestParams.page"
        :loading="isLoadingApplications"
        key-field="id"
        @navigate="handleNavigate"
        @page-change="(e: CustomEvent) => { requestParams.page = e.detail.page; }"
        @selection-change="handleSelectionChange"
      />
    <AppModal ref="appModal" />
    <AppDeleteModal ref="deleteModal" />
    <ExportAppModal ref="exportAppModal" />
    <BulkDeleteModal
      ref="bulkDeleteModal"
      resource-label="application"
      :resource-type="resource"
      :show-delete-image-option="true"
      @settled="handleBulkDeleted"
    />
  </div>
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

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 500px;
}

</style>
