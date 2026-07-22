<script setup lang="ts">
import { useStore } from 'vuex';
import { ref, onMounted, onUnmounted, computed, watchEffect, watch } from 'vue';
import { EPINIO_TYPES } from '../types';
import Banner from '@components/Banner/Banner.vue';
import Masthead from '@shell/components/ResourceList/Masthead';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { startPolling, stopPolling } from '../utils/polling';
import { makeActionMenu } from '../utils/table-formatters';
import EpinioNamespace from 'models/namespaces';
import { overrideTableRows } from '../utils/table-formatters';
import { debounce } from 'lodash';
import { useNamespaces } from '../queries/useNamespace';

defineProps<{
  schema: object,
  rows: Array<EpinioNamespace>,
}>();

const store = useStore() as any;
const t = store.getters['i18n/t'];

const errors = ref<Array<string>>([]);
const resource: string = EPINIO_TYPES.NAMESPACE;
const displayRows = ref<EpinioNamespace[]>([]);

const paginationMeta = computed(() => store.getters['epinio/paginationMeta'](resource));
const currentPage = computed(() => store.getters['epinio/currentPaginationPage'](resource));

const searchQuery = ref<string>('');

const paginating = ref(false);

const {data: namespaces, isLoading, isError, error} = useNamespaces(store);

watchEffect(() => {
  if (namespaces.value) {
    console.log('|||||||||||||||||||| Namespaces fetched:', namespaces.value);
  }
});

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

const value = ref<EpinioNamespace>({ meta: { name: '' } } as EpinioNamespace);
const showCreateModal = ref<boolean>(false);
const namespaceNameInput = ref<HTMLElement | null>(null);
const creatingNamespace = ref<boolean>(false);

const namespaceToDelete = ref<EpinioNamespace | null>(null);
const showDeleteModal = ref<boolean>(false);
const deleteNamespaceInput = ref<HTMLElement | null>(null);
const deletingNamespace = ref<boolean>(false);
const confirmDeleteInput = ref<string>('');

// Strict RBAC: only show Create/Delete when the user has namespace write perms (admin).
// Defined ahead of the watchEffect that consumes them to avoid a TDZ on first run.
const canCreateNamespace = computed(() => {
  const can = store.getters['epinio/can'];
  const perms = store.getters['epinio/permissions']?.();

  if (!can || !perms || Object.keys(perms).length === 0) {
    return false;
  }

  return can('namespace_write') || can('namespace');
});
const canDelete = canCreateNamespace;

watchEffect(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE) as EpinioNamespace[];

  // Touch meta so _MERGE polling (which deletes/re-adds all properties) re-runs this effect
  all.forEach((row) => { void row.meta; });

  // Add custom namespace delete action to replace the built in rancher shell flow.
  // Gate by namespace write perms so view-only / app-only roles don't see Delete.
  const overrideProps = [{
    prop: 'availableActions',
    value: (row: any) => {
      if (!canDelete.value || !row.canDelete) {
        return [];
      }

      return [{
        action: 'removeNamespace',
        altAction: 'remove',
        bulkAction: 'removeNamespace',
        bulkable: true,
        enabled: true,
        icon: 'icon icon-trash',
        label: 'Delete',
        weight: -10
      }]
    },
    conditionFn: () => true,
  },
  {
    prop: 'removeNamespace',
    value: (row: EpinioNamespace) => () => {
      namespaceToDelete.value = row;
      openDeleteModal();
    },
    conditionFn: (row: EpinioNamespace) => canDelete.value && row.canDelete,
  }];
  displayRows.value = overrideTableRows(all, overrideProps);
});

const validateCreate = computed(() => {
  if (!value.value.meta.name?.length) {
    return false;
  }

  const validationErrors = getNamespaceErrors(value.value.meta.name);

  return validationErrors.length === 0;
});


const validateDelete = computed(() => {
  return confirmDeleteInput.value === namespaceToDelete.value?.meta.name;
});

onMounted(() => {
  store.dispatch('epinio/me');

  // Opens the create namespace modal if the query is passed as query param
  if (store.$router.currentRoute._value.query.mode === 'openModal') {
    openCreateModal();
  }

  startPolling(['namespaces', 'applications', 'configurations'], store);
});

onUnmounted(() => {
  stopPolling(['namespaces', 'applications', 'configurations']);
  store.dispatch('epinio/search', { type: resource, query: '' });
});

async function openCreateModal() {
  showCreateModal.value = true;
  // Create a skeleton namespace
  value.value = await store.dispatch(
    `epinio/create`,
    { type: EPINIO_TYPES.NAMESPACE },
  );
}

function closeCreateModal() {
  showCreateModal.value = false;
  errors.value = [];
}

async function onSubmitCreate() {
  creatingNamespace.value = true;
  try {
    await value.value.create();
    closeCreateModal();
  } catch (e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
  } finally {
    creatingNamespace.value = false;
  }
}

function getNamespaceErrors(name: string) {
  const kubernetesErrors = validateKubernetesName(
    name || '',
    t('epinio.namespace.name'),
    store.getters,
    undefined,
    [],
  );

  if (kubernetesErrors.length) {
    return [kubernetesErrors.join(', ')];
  }

  const validateName = name.match(/[a-z0-9]([-a-z0-9]*[a-z0-9])?/);

  if (
    !validateName ||
    validateName[0] !== name &&
    !errors.value.includes(t('epinio.namespace.validations.name'))
  ) {
    return [t('epinio.namespace.validations.name')];
  }

  return [];
}

function openDeleteModal() {
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
  confirmDeleteInput.value = '';
  errors.value = [];
}

async function onSubmitDelete() {
  if (!namespaceToDelete.value) {
    return;
  }
  try {
    deletingNamespace.value = true;
    await namespaceToDelete.value.remove();
    closeDeleteModal();
    store.dispatch('findAll', { type: 'applications', opt: { force: true } });
  } catch(e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
  } finally {
    deletingNamespace.value = false;
  }
}

const columns = [
  {
    field: 'meta.name',
    label: 'Name'
  },
  {
    field: 'appCount',
    label: 'Applications'
  },
  {
    field: 'configCount',
    label: 'Configurations'
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
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
        placeholder="Search..."
        @text-input-change="(e: CustomEvent) => searchQuery = e.detail.value"
      ></trailhand-text-input>
    </div>
    <trailhand-table
      :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
      :rows="displayRows"
      :columns="columns"
      :server-side="!!paginationMeta"
      :total-items="paginationMeta?.totalItems ?? displayRows.length"
      :current-page="currentPage"
      :loading="paginating"
      :searchable="false"
      key-field="_key"
      @page-change="(e: CustomEvent) => goToPage(e.detail.page)"
    />
    <trailhand-modal
      :open.prop="showCreateModal"
      :title="t('epinio.namespace.create')"
      @modal-open="() => namespaceNameInput?.focus()"
      @modal-close="closeCreateModal"
    >
      <div class="modal-content">
        <trailhand-text-input
          ref="namespaceNameInput"
          :value="value.meta.name"
          placeholder="Namespace Name"
          :label="t('epinio.namespace.name')"
          :required="true"
          size="large"
          @text-input-change="value.meta.name = $event.detail.value"
          @keydown="(e: KeyboardEvent) => { if (e.key === 'Enter' && validateCreate) onSubmitCreate(); }"
        ></trailhand-text-input>
        <Banner
          v-for="(err, i) in errors"
          :key="i"
          color="error"
          :label="err"
        />  
      </div>
      <div slot="footer">
        <trailhand-button variant="secondary" class="mr-10" @button-click="closeCreateModal"
          >Cancel</trailhand-button
        >
        <trailhand-button :disabled="!validateCreate || creatingNamespace" variant="primary" @button-click="onSubmitCreate"
          >{{ creatingNamespace ? 'Creating...' : t('generic.create') }}</trailhand-button
        >
      </div>
    </trailhand-modal>
    <trailhand-modal
      :open.prop="showDeleteModal"
      title="Are you sure?"
      @modal-open="() => deleteNamespaceInput?.focus()"
      @modal-close="closeDeleteModal"
    >
      <div class="modal-content">
        <p>You are attempting to delete the Namespace <strong>{{ namespaceToDelete?.meta.name }}</strong>.</p>
        <p>Enter <strong>{{ namespaceToDelete?.meta.name }}</strong> below to confirm:</p>
        <trailhand-text-input
          ref="deleteNamespaceInput"
          :value="confirmDeleteInput"
          size="large"
          @text-input-change="confirmDeleteInput = $event.detail.value"
          @keydown="(e: KeyboardEvent) => { if (e.key === 'Enter' && validateDelete) onSubmitDelete(); }"
        ></trailhand-text-input>
        <Banner
          v-for="(err, i) in errors"
          :key="i"
          color="error"
          :label="err"
        />
      </div>
      <div slot="footer">
        <trailhand-button variant="secondary" class="mr-10" @button-click="closeDeleteModal"
          >Cancel</trailhand-button
        >
        <trailhand-button :disabled="!validateDelete || deletingNamespace" variant="destructive" @button-click="onSubmitDelete"
          >{{ deletingNamespace ? 'Deleting...' : t('generic.delete') }}</trailhand-button
        >
      </div>
    </trailhand-modal>
  </div>
</template>

<style lang='scss' scoped>
.modal {
  position: fixed;
  z-index: 50;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgb(0,0,0);
  background-color: rgba(0,0,0,0.4);
  border-radius: var(--border-radius);

  .banner {
    margin-bottom: 0;
  }
}

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 500px;
}

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

