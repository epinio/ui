<script setup lang="ts">
import { useStore } from 'vuex';
import { ref, onMounted, onUnmounted, computed, watch, nextTick, useAttrs } from 'vue';
import { EPINIO_TYPES } from '../types';
import { Card } from '@components/Card';
import Banner from '@components/Banner/Banner.vue';
import { _CREATE } from '@shell/config/query-params';
import AsyncButton from '@shell/components/AsyncButton';
import DataTable from '../components/tables/DataTable.vue';
import type { DataTableColumn } from '../components/tables/types';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter.vue';
import Masthead from '@shell/components/ResourceList/Masthead';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { startPolling, stopPolling } from '../utils/polling';

defineProps<{
  schema: object,
  rows: Array,
}>();

//const attrs = useAttrs();
const store = useStore();
const t = store.getters['i18n/t'];

const errors = ref<Array>([]);
const namespaceName = ref('namespaceName');
const showCreateModal = ref<boolean>(false);
const creatingNamespace = ref<boolean>(false);
const touched = ref<boolean>(false);

const mode: string = _CREATE;
const resource: string = EPINIO_TYPES.NAMESPACE;
const value = ref<Array>({ meta: { name: '' } });

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

  startPolling(["namespaces", "applications", "configurations"], store);
});

onUnmounted(() => {
  stopPolling(["namespaces", "applications", "configurations"]);
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
  // Focus on the name input field... after it's been displayed
  nextTick(() => namespaceName.value.focus());
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

async function onSubmit(buttonCb) {
  creatingNamespace.value = true;
  try {
    await value.value.create();
    closeCreateModal();
    buttonCb(true);
    touched.value = false;
  } catch (e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
    buttonCb(false);
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

const columns: DataTableColumn[] = [
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
  <div>
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template #createButton>
        <button
          class="btn role-primary"
          @click="openCreateModal"
        >
          {{ t('generic.create') }}
        </button>
      </template>
    </Masthead>
    <DataTable
      :rows="rows"
      :columns="columns"
      key-field="_key"
    >
      <template #cell:stateDisplay="{ row }">
        <BadgeStateFormatter
          :row="row"
          :value="row.stateDisplay"
        />
      </template>
    </DataTable>
    <div
      v-if="showCreateModal"
      class="modal"
    >
      <Card
        class="modal-content"
        :show-actions="true"
      >
        <template #title>
          <h4
            v-clean-html="t('epinio.namespace.create')"
          />
        </template>
        <template #body class="model-body">
          <LabeledInput
            ref="namespaceName"
            v-model:value="value.meta.name"
            :label="t('epinio.namespace.name')"
            :required="true"
          />
          <div v-if="touched">
            <Banner
              v-for="(err, i) in errors"
              :key="i"
              color="error"
              :label="err"
            />
          </div>
        </template>
        <template #actions class="model-actions">
          <button
            class="btn role-secondary mr-10"
            @click="closeCreateModal"
          >
            {{ t('generic.cancel') }}
          </button>
          <AsyncButton
            :disabled="!validationPassed"
            :mode="mode"
            @click="onSubmit"
          />
        </template>
      </Card>
    </div>
  </div>
</template>

<style lang='scss' scoped>
.modal {
  position: fixed; /* Stay in place */
  z-index: 50; /* Sit on top */
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
  background-color: var(--default);
  margin: 15% auto;
  padding: 20px;
  border: 1px solid #888;
  width: 50%;
  max-width: 500px;

  .model-body {
    min-height: 116px;
  }

  .model-actions {
    justify-content: flex-end;
    display: flex;
    flex: 1;
  }

}
</style>

