<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';
import Masthead from '@shell/components/ResourceList/Masthead';
import { makeEmptyCell, makeRouterLinks, makeRouterLinksOrEmpty, makeActionMenu, overrideTableRows } from '../utils/table-formatters';
import ConfigurationModal from '../components/configuration/ConfigurationModal.vue';

const store = useStore();
const router = useRouter();

defineProps<{ schema: object }>(); // Keep for compatibility

const resource: string = EPINIO_TYPES.CONFIGURATION;
const configModal = ref<InstanceType<typeof ConfigurationModal> | null>(null);
const windowWidth = ref(window.innerWidth);
const onResize = () => { windowWidth.value = window.innerWidth; };
const displayRows = ref<any[]>([]);

onMounted(() => {
  window.addEventListener('resize', onResize);
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
      value: (row: any) => [
        {
          action:     'editConfigModal',
          label:      'Edit',
          enabled:    row.configuration?.type === 'custom',
          icon:       'icon icon-edit',
        },
        {
          action:     'promptRemove',
          altAction:  'remove',
          bulkAction: 'promptRemove',
          bulkable:   true,
          enabled:    row._canDelete,
          icon:       'icon icon-trash',
          label:      'Delete',
          weight:     -10,
        },
      ],
      conditionFn: () => true,
    },
    {
      prop:        'editConfigModal',
      value:       (row: any) => () => { configModal.value?.openEdit(row); },
      conditionFn: (row: any) => row.configuration?.type === 'custom',
    },
  ];

  displayRows.value = [...overrideTableRows(filtered, overrides)];
});

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};

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
          variant="primary"
          size="large"
          @click="handleCreateClick"
        >
          {{ t('generic.create') }}
        </trailhand-button>
      </template>
    </Masthead>
    <trailhand-table
      :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
      :rows="displayRows"
      :columns="columns"
      :searchable="true"
      key-field="id"
      @navigate="handleNavigate"
    />
    <ConfigurationModal ref="configModal" />
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
