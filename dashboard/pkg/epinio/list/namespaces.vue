<script setup lang="ts">
import { mapGetters, mapState, useStore } from 'vuex';
import { Location, useRouter, useRoute } from 'vue-router';
import { ref, onMounted, computed, watch, nextTick } from 'vue';

import { EPINIO_TYPES } from '../types';
import { Card } from '@components/Card';
import Banner from '@components/Banner/Banner.vue';
import { _CREATE } from '@shell/config/query-params';
import AsyncButton from '@shell/components/AsyncButton';
import ResourceTable from '@shell/components/ResourceTable';
import Masthead from '@shell/components/ResourceList/Masthead';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';

const props = defineProps<{
  schema: object,
  rows: array,
}>();

const store = useStore();
const router = useRouter();
const route = useRoute();
const t = store.getters['i18n/t'];

const errors = ref<array>([]);
const namespaceName = ref('namespaceName');
const showCreateModal = ref<boolean>(false);
const creatingNamespace = ref<boolean>(false);

const mode: string = _CREATE;
const submitted: boolean = false;
const validFields: array = { name: false };
const resource: string = EPINIO_TYPES.NAMESPACE;
const value = ref<array>({ meta: { name: '' } });

const showPromptRemove = computed(() => { 
  return store.state['action-menu'].showPromptRemove
});

const validationPassed = computed(() => {
  // Add here fields that need validation
  if (!creatingNamespace.value) {
    errors.value = [];
    errors.value = getNamespaceErrors(value.value.meta.name);
  }

  return errors.value?.length === 0;
});

onMounted(() => {
  // Opens the create namespace modal if the query is passed as query param
  if (route.query.mode === 'openModal') {
    openCreateModal();
  }
});

watch(
  () => showPromptRemove,
  (newState, oldState) => {
    if (oldState === true && newState === false) {
      // Refetch apps when namespace is deleted
      store.dispatch('findAll', { type: 'applications', opt: { force: true } });
    }
  }
);

// Watch for changes in value.meta.name, not needed as there are no rules currently
watch(
  () => value.value.meta.name,
  () => {
    creatingNamespace.value = false;
    validateNamespace();
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
}

async function onSubmit(buttonCb) {
  creatingNamespace.value = true;
  try {
    await value.value.create();
    closeCreateModal();
    buttonCb(true);
  } catch (e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
    buttonCb(false);
  }
}

function validateNamespace(name) {
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
</script>

<template>
  <div>
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template v-slot:createButton>
        <button
          class="btn role-primary"
          @click="openCreateModal"
        >
          {{ t('generic.create') }}
        </button>
      </template>
    </Masthead>
    <ResourceTable
      v-bind="$attrs"
      :rows="rows"
      :groupable="false"
      :schema="schema"
      key-field="_key"
      :useQueryParamsForSimpleFiltering="true"
    />
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
        <template class="model-body" #body>
          <LabeledInput
            ref="namespaceName"
            v-model:value="value.meta.name"
            :label="t('epinio.namespace.name')"
            :required="true"
          />
          <Banner
            v-for="(err, i) in errors"
            :key="i"
            color="error"
            :label="err"
          />
        </template>
        <template class="model-actions" #actions>
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

