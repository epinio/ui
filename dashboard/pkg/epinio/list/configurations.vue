<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';
import Masthead from '@shell/components/ResourceList/Masthead';
import { makeEmptyCell, makeRouterLinks, makeRouterLinksOrEmpty, makeActionMenu, overrideTableRows } from '../utils/table-formatters';
import ConfigurationModal from '../components/configuration/ConfigurationModal.vue';
import ConfigurationDeleteModal from '../components/configuration/ConfigurationDeleteModal.vue';

const store = useStore();
const router = useRouter();

defineProps<{ schema: object }>(); // Keep for compatibility

const resource: string = EPINIO_TYPES.CONFIGURATION;

const configModal = ref<InstanceType<typeof ConfigurationModal> | null>(null);
const deleteModal = ref<InstanceType<typeof ConfigurationDeleteModal> | null>(null);
const windowWidth = ref(window.innerWidth);
const onResize = () => { windowWidth.value = window.innerWidth; };
const displayRows = ref<any[]>([]);

onMounted(() => {
  window.addEventListener('resize', onResize);
  store.dispatch('epinio/me');
  store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.CONFIGURATION });
  startPolling(['configurations'], store);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  stopPolling(['configurations']);
});

const handleCreateClick = () => {
  configModal.value?.openCreate();
};

// Strict RBAC: only show Create when user has configuration write (hides for view_only)
const canCreateConfiguration = computed(() => {
  const can = store.getters['epinio/can'];
  const perms = store.getters['epinio/permissions']?.();

  if (!can || !perms || Object.keys(perms).length === 0) {
    return false;
  }

  return can('configuration_write') || can('configuration');
});

// Edit/Delete share the same permission as Create — anything that mutates
// a configuration requires configuration_write.
const canEdit = canCreateConfiguration;
const canDelete = canCreateConfiguration;

watchEffect(() => {
  void store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;
  const all = store.getters['epinio/all'](EPINIO_TYPES.CONFIGURATION) as any[];

  all.forEach((row: any) => { void row.status; void row.stateDisplay; void row.meta; });

  const filtered = all.filter((row: any) => {
    const ns = row.meta?.namespace;

    return !activeNamespaces || Object.keys(activeNamespaces).length === 0 || activeNamespaces[ns];
  });

  const overrides = [
    {
      prop: 'availableActions',
      value: (row: any) => {
        const out: any[] = [];

        if (canEdit.value) {
          out.push({
            action:  'editConfigModal',
            label:   'Edit',
            enabled: row.configuration?.type === 'custom',
            icon:    'icon icon-edit',
          });
        }
        if (canDelete.value) {
          out.push({
            action:  'deleteConfigModal',
            label:   'Delete',
            enabled: row.configuration?.type === 'custom',
            icon:    'icon icon-trash',
            weight:  -10,
          });
        }

        return out;
      },
      conditionFn: () => true,
    },
    {
      prop:        'editConfigModal',
      value:       (row: any) => () => { configModal.value?.openEdit(row); },
      conditionFn: (row: any) => canEdit.value && row.configuration?.type === 'custom',
    },
    {
      prop:        'deleteConfigModal',
      value:       (row: any) => () => { deleteModal.value?.openDelete(row); },
      conditionFn: (row: any) => canDelete.value && row.configuration?.type === 'custom',
    },
  ];

  displayRows.value = [...overrideTableRows(filtered, overrides)];
});

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};

const paginationMeta = computed(() => store.getters['epinio/paginationMeta'](resource));
const currentPage = computed(() => store.getters['epinio/currentPaginationPage'](resource));

const paginating = ref(false);

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

const allColumns = [
  {
    field: 'nameDisplay',
    label: 'Name',
    width: '200px',
    formatter: (_v: any, row: any) => {
      const el = document.createElement('a');

      el.textContent = row.nameDisplay || row.meta?.name || '';
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        configModal.value?.openView(row);
      });

      return el;
    }
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    width: '250px',
    sortable: false,
    formatter: (_v: any, row: any) => makeRouterLinksOrEmpty(row.applications, router)
  },
  {
    field: 'service',
    label: 'Service',
    width: '150px',
    sortable: false,
    formatter: (_v: any, row: any) => row.service
      ? makeRouterLinks([row.service], router)
      : makeEmptyCell()
  },
  {
    field: 'variableCount',
    label: 'No. of Variables',
    width: '150px'
  },
  {
    field: 'configuration.user',
    label: 'Created By',
    width: '150px',
    formatter: (_v: any, row: any) => row.configuration?.user || makeEmptyCell()
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    width: '50px',
    formatter: 'age'
  }
];

// Drop lower-priority columns at smaller window widths
//   <1300px: hide Service and Created By
//   <1100px: also hide Age
const columns = computed(() => {
  const w = windowWidth.value;
  const hide = new Set<string>();

  if (w < 1300) {
    hide.add('service');
    hide.add('configuration.user');
  }
  if (w < 1100) {
    hide.add('meta.createdAt');
  }

  return allColumns.filter(col => !hide.has(col.field));
});
</script>

<template>
  <div id="modal-container-element">
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template #createButton>
        <trailhand-button
          v-if="canCreateConfiguration"
          variant="primary"
          size="large"
          @click="handleCreateClick"
        >
          {{ t('generic.create') }}
        </trailhand-button>
        <div v-else></div>
      </template>
    </Masthead>
    <trailhand-table
      :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
      :rows="displayRows"
      :columns="columns"
      :searchable="true"
      :server-side="!!paginationMeta"
      :total-items="paginationMeta?.totalItems ?? displayRows.length"
      :current-page="currentPage"
      :loading="paginating"
      key-field="id"
      @navigate="handleNavigate"
      @page-change="(e: CustomEvent) => goToPage(e.detail.page)"
    />
    <ConfigurationModal ref="configModal" />
    <ConfigurationDeleteModal ref="deleteModal" />
  </div>
</template>

<style lang="scss" scoped>
trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
  overflow-wrap: anywhere;
}

</style>
