<script setup lang="ts">
import { useStore } from 'vuex';
import { ref, onMounted, onUnmounted, computed, watchEffect } from 'vue';
import { EPINIO_TYPES } from '../types';
import Banner from '@components/Banner/Banner.vue';
import { _CREATE } from '@shell/config/query-params';
import Masthead from '@shell/components/ResourceList/Masthead';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { startPolling, stopPolling } from '../utils/polling';
import { makeActionMenu } from '../utils/table-formatters';
import EpinioNamespace from 'models/namespaces';

defineProps<{
  schema: object,
  rows: Array<EpinioNamespace>,
}>();

const store = useStore() as any;
const t = store.getters['i18n/t'];

const errors = ref<Array<string>>([]);
const resource: string = EPINIO_TYPES.NAMESPACE;

const displayRows = ref<EpinioNamespace[]>([]);

const value = ref<EpinioNamespace>({ meta: { name: '' } } as EpinioNamespace);
const showCreateModal = ref<boolean>(false);
const namespaceNameInput = ref<HTMLElement | null>(null);
const creatingNamespace = ref<boolean>(false);

const namespaceToDelete = ref<EpinioNamespace | null>(null);
const showDeleteModal = ref<boolean>(false);
const deleteNamespaceInput = ref<HTMLElement | null>(null);
const deletingNamespace = ref<boolean>(false);
const confirmDeleteInput = ref<string>('');

watchEffect(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE) as EpinioNamespace[];

  // Touch meta so _MERGE polling (which deletes/re-adds all properties) re-runs this effect
  all.forEach((row) => { void row.meta; });

  // Add custom namespace delete action to replace the built in rancher shell flow
  const overrides = all.map((row) => {
  if (row.canDelete) {
    Object.defineProperty(row, 'availableActions', {
      value: [{
        action: 'removeNamespace',
        altAction: 'remove',
        bulkAction: 'removeNamespace',
        bulkable: true,
        enabled: true,
        icon: 'icon icon-trash',
        label: 'Delete',
        weight: -10
      }],
      writable: true,
      configurable: true,
    });
    Object.defineProperty(row, 'removeNamespace', {
      value: () => {
        namespaceToDelete.value = row;
        openDeleteModal();
      },
      writable: true,
      configurable: true,
    });
  }
  return row;
});
  displayRows.value = [...overrides];
});

const validateCreate = computed(() => {
  if (!value.value.meta.name?.length) {
    return false;
  }

  const validationErrors = getNamespaceErrors(value.value.meta.name); // eslint-disable-line vue/no-side-effects-in-computed-properties

  return validationErrors.length === 0;
});

const validateDelete = computed(() => {
  return confirmDeleteInput.value === namespaceToDelete.value?.meta.name;
});

onMounted(() => {
  // Opens the create namespace modal if the query is passed as query param
  if (store.$router.currentRoute._value.query.mode === 'openModal') {
    openCreateModal();
  }

  startPolling(['namespaces', 'applications', 'configurations'], store);
});

onUnmounted(() => {
  stopPolling(['namespaces', 'applications', 'configurations']);
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
          @click="openCreateModal"
        >
          {{ t('generic.create') }}
        </trailhand-button>
      </template>
    </Masthead>
    <trailhand-table
      :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
      :rows="displayRows"
      :columns="columns"
      key-field="_key"
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
        <trailhand-button @button-click="closeCreateModal" variant="secondary" class="mr-10"
          >Cancel</trailhand-button
        >
        <trailhand-button @button-click="onSubmitCreate" :disabled="!validateCreate || creatingNamespace" variant="primary"
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
        <trailhand-button @button-click="closeDeleteModal" variant="secondary" class="mr-10"
          >Cancel</trailhand-button
        >
        <trailhand-button @button-click="onSubmitDelete" :disabled="!validateDelete || deletingNamespace" variant="destructive"
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

trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}
</style>

