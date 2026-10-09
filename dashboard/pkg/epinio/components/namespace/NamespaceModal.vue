<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import Banner from '@components/Banner/Banner.vue';
import { useCreateNamespace } from '../../queries/useNamespaceMutations';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);

// Form fields (separate from the model to avoid proxy mutation issues)
const newNamespaceInput = ref<HTMLElement | null>(null);
const newNamespaceName = ref<string>('');

const {mutate: createNamespace, isPending: isCreatingNamespace, isError: createNamespaceError, error: createNamespaceErrorData} = useCreateNamespace(store, closeModal);

const showDiscardConfirm = ref(false);

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
    validateName[0] !== name
  ) {
    return [t('epinio.namespace.validations.name')];
  }

  return [];
}

const validationPassed = computed(() => {
 if (!newNamespaceName.value?.length) {
    return false;
  }

  const validationErrors = getNamespaceErrors(newNamespaceName.value);

  return validationErrors.length === 0;
});

function openCreate() {
  showModal.value = true;
}

function handleModalClose() {
  if (newNamespaceName.value.length > 0) {
    showDiscardConfirm.value = true;
  } else {
    closeModal();
  }
}

function handleKeepEditing() {
  showDiscardConfirm.value = false;
}

function handleDiscard() {
  showDiscardConfirm.value = false;
  closeModal();
}

function closeModal() {
  showModal.value = false;
  newNamespaceName.value = '';
}

async function onSubmit() {
  createNamespace({ name: newNamespaceName.value });
}

defineExpose({ openCreate });
</script>

<template>
    <trailhand-modal
      :open.prop="showModal"
      :title="t('epinio.namespace.create')"
      :dismissible="false"
      @modal-open="() => newNamespaceInput?.focus()"
      @modal-close="closeModal"
    >
      <div class="modal-content">
        <trailhand-text-input
          ref="newNamespaceInput"
          :value="newNamespaceName"
          :placeholder="t('epinio.namespace.placeholders.name')"
          :label="t('epinio.namespace.name')"
          :required="true"
          size="large"
          @text-input-change="newNamespaceName = $event.detail.value"
          @keydown="(e: KeyboardEvent) => { if (e.key === 'Enter' && validationPassed) onSubmit(); }"
        ></trailhand-text-input>
        <Banner
          v-if="createNamespaceError"
          color="error"
          :label="createNamespaceErrorData?.message || t('epinio.namespace.errors.create')"
        />  
      </div>
      <div slot="footer">
      <template v-if="showDiscardConfirm">
        <span class="discard-message">{{ t('epinio.unsavedChanges.warning') }}</span>
        <trailhand-button
          variant="secondary"
          class="mr-10"
          @button-click="handleKeepEditing"
        >
          {{ t('generic.keepEditing') }}
        </trailhand-button>
        <trailhand-button
          variant="destructive"
          @button-click="handleDiscard"
        >
          {{ t('generic.discard') }}
        </trailhand-button>
      </template>
      <template v-else>
        <trailhand-button
          variant="secondary"
          class="mr-10"
          @button-click="handleModalClose"
        >
          {{ t('generic.cancel') }}
        </trailhand-button>
        <trailhand-button
          variant="primary"
          :disabled="!validationPassed || isCreatingNamespace"
          @button-click="onSubmit"
        >
          {{ isCreatingNamespace ? t('generic.creating') : t('generic.create') }}
        </trailhand-button>
      </template>
    </div>
    </trailhand-modal>
</template>

<style lang="scss" scoped>
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 560px;
}

.discard-message {
  font-size: 13px;
  color: var(--body-text);
  margin-right: 12px;
}
</style>
