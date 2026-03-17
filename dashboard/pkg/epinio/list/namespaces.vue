<script setup lang="ts">
import { useStore } from 'vuex';
import { ref, onMounted, onUnmounted, computed, watch, watchEffect, nextTick } from 'vue';
import { EPINIO_TYPES } from '../types';
import { Card } from '@components/Card';
import Banner from '@components/Banner/Banner.vue';
import { _CREATE } from '@shell/config/query-params';
import AsyncButton from '@shell/components/AsyncButton';
import Masthead from '@shell/components/ResourceList/Masthead';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { startPolling, stopPolling } from '../utils/polling';
import { makeActionMenu } from '../utils/table-formatters';

defineProps<{
  schema: object,
  rows: Array,
}>();

const store = useStore();
const t = store.getters['i18n/t'];

const errors = ref<Array>([]);
const namespaceNameInput = ref<HTMLElement | null>(null);
const showCreateModal = ref<boolean>(false);
const creatingNamespace = ref<boolean>(false);
const touched = ref<boolean>(false);

const mode: string = _CREATE;
const resource: string = EPINIO_TYPES.NAMESPACE;
const value = ref<Array>({ meta: { name: '' } });

const displayRows = ref<any[]>([]);

watchEffect(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE) as any[];

  // Touch meta so _MERGE polling (which deletes/re-adds all properties) re-runs this effect
  all.forEach((row: any) => { void row.meta; });
  displayRows.value = [...all];
});

const showPromptRemove = computed(() => {
  return store.state['action-menu'].showPromptRemove
});

const validationPassed = computed(() => {
  // Add here fields that need validation
  if (!creatingNamespace.value) {
    errors.value = []; // eslint-disable-line vue/no-side-effects-in-computed-properties
    errors.value = getNamespaceErrors(value.value.meta.name); // eslint-disable-line vue/no-side-effects-in-computed-properties
  }

  return errors.value?.length === 0;
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

watch(
  () => showPromptRemove,
  (newState, oldState) => {
    if (oldState === true && newState === false) {
      // Refetch apps when namespace is deleted
      //store.dispatch('findAll', { type: 'applications', opt: { force: true } });
    }
  }
);

// Watch for changes in value.meta.name, not needed as there are no rules currently
watch(
  () => value.value.meta.name,
  () => {
    creatingNamespace.value = false;
    validateNamespace(value.value.meta.name);
  }
);

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
  touched.value = false;
}

async function onSubmit() {
  creatingNamespace.value = true;
  try {
    await value.value.create();
    closeCreateModal();
    touched.value = false;
  } catch (e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
  } finally {
    creatingNamespace.value = false;
  }
}

function validateNamespace(name) {
  if (!name?.length && !touched.value) {
    touched.value = true;
  }

  errors.value = getNamespaceErrors(name);
}

function getNamespaceErrors(name) {
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
          @keydown="(e: KeyboardEvent) => { if (e.key === 'Enter') onSubmit(); }"
        ></trailhand-text-input>
      </div>
      <div slot="footer">
        <trailhand-button @button-click="closeCreateModal" variant="secondary" class="mr-10"
          >Cancel</trailhand-button
        >
        <trailhand-button @button-click="onSubmit" :disabled="!validationPassed || creatingNamespace" variant="primary"
          >{{ creatingNamespace ? 'Creating...' : t('generic.create') }}</trailhand-button
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

