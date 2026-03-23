<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

import { EPINIO_TYPES } from '../types';
import { startPolling, stopPolling } from '../utils/polling';
import Masthead from '@shell/components/ResourceList/Masthead';
import Banner from '@components/Banner/Banner.vue';
import { createEpinioRoute } from '../utils/custom-routing';
import { makeStateTag, makeRouterLink, makeRouterLinksOrEmpty, makeActionMenu } from '../utils/table-formatters';
import EpinioServiceModel from 'models/services';
import { overrideTableRows } from '../utils/table-formatters';
import { epinioExceptionToErrorsArray } from '../utils/errors';

defineProps<{
  schema: object,
}>();

const resource: string = EPINIO_TYPES.SERVICE_INSTANCE;

const store = useStore();
const router = useRouter();

const showDeleteModal = ref<boolean>(false);
const serviceToDelete = ref<EpinioServiceModel | null>(null);
const errors = ref<Array<string>>([]);
const deletingService = ref<boolean>(false);

onMounted(() => {
  store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  startPolling(['services'], store);
});

onUnmounted(() => {
  stopPolling(['services']);
});

const handleCreateClick = () => {
  store.$router.push(createEpinioRoute('c-cluster-resource-create', { resource: EPINIO_TYPES.SERVICE_INSTANCE }));
};

const rows = computed(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE) as any[];

  all.forEach((row: any) => { void row.status; void row.stateDisplay; void row.meta; });

  // Filter empty rows that are added during delete
  const filtered = all.filter((row) => row.id);

  // Add custom service delete action to replace the built in rancher shell flow
  const overrideProps = [{
    prop: 'availableActions',
    value: (row: EpinioServiceModel) => {
      const newActions: any[] = [];
      const availableActions = row.availableActions || [];
      availableActions.forEach((action) => {
        if (action.action === 'promptRemove') {
          newActions.push({
            action: 'removeService',
            altAction: 'remove',
            bulkAction: 'removeService',
            bulkable: true,
            enabled: row.canDelete,
            icon: 'icon icon-trash',
            label: 'Delete',
            weight: -10
          });
        } else {
          newActions.push(action);
        }
      });
      return newActions;
    },
    conditionFn: (row: EpinioServiceModel) => {
      return row.canDelete;
    },
  },
  {
    prop: 'removeService',
    value: (row: EpinioServiceModel) => () => {
      serviceToDelete.value = row;
      openDeleteModal();
    },
    conditionFn: (row: EpinioServiceModel) => {
      return row.canDelete;
    },
  }];

  const processedRows = overrideTableRows(filtered, overrideProps);
  return processedRows;
});

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};

function openDeleteModal() {
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
  errors.value = [];
}

async function onSubmitDelete() {
  if (!serviceToDelete.value) {
    return;
  }
  try {
    deletingService.value = true;
    await serviceToDelete.value.remove();
    closeDeleteModal();
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE, opt: { force: true } });
    store.dispatch('findAll', { type: 'applications', opt: { force: true } });
  } catch(e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
  } finally {
    deletingService.value = false;
  }
}

const columns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px',
    formatter: (_v: any, row: any) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    link:  (row: any) => {
      try { return router.resolve(row.detailLocation).href; } catch { return '#'; }
    }
  },
  {
    field: 'catalog_service',
    label: 'Catalog Service',
    sortable: false,
    formatter: (_v: any, row: any) => makeRouterLink(row.catalog_service, row.serviceLocation, router)
  },
  {
    field: 'catalog_service_version',
    label: 'Catalog Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false,
    formatter: (_v: any, row: any) => makeRouterLinksOrEmpty(row.applications, router)
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];
</script>

<template>
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
    :rows="rows"
    :columns="columns"
    :searchable="true"
    key-field="id"
    @navigate="handleNavigate"
  />
  <trailhand-modal
    :open.prop="showDeleteModal"
    title="Are you sure?"
    @modal-close="closeDeleteModal"
  >
    <div class="modal-content">
      <p>You are attempting to delete the Instance <strong>{{ serviceToDelete?.meta.name }}</strong>.</p>
      <div v-if="(serviceToDelete as any)?.boundapps?.length">
        <p>The following applications are bound to the Service Instance about to be deleted. Please unbind them before proceeding.</p>
        <ul>
          <li v-for="app in (serviceToDelete as any)?.boundapps || []" :key="app">{{ app }}</li>
        </ul>
      </div>
      <p v-else>No applications are bound to this Service Instance.</p>
      <Banner
          v-for="(err, i) in errors"
          :key="i"
          color="error"
          :label="err"
        />
    </div>
    <div slot="footer">
      <trailhand-button @button-click="closeDeleteModal" variant="secondary" class="mr-10"
        >Cancel</trailhand-button
      >
      <trailhand-button @button-click="onSubmitDelete" :disabled="deletingService || (serviceToDelete as any)?.boundapps?.length" variant="destructive"
        >{{ deletingService ? 'Deleting...' : t('generic.delete') }}</trailhand-button
      >
    </div>
  </trailhand-modal>
</template>

<style lang="scss" scoped>
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
