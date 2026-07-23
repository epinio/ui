<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import { useDeleteNamespace } from '../../queries/useNamespaceMutations';
import { Namespace } from '../../models/namespace/types';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);

// Form fields (separate from the model to avoid proxy mutation issues)
const deleteNamespaceInput = ref<HTMLElement | null>(null);
const confirmDeleteInput = ref<string>('');
const namespaceToDelete = ref<Namespace | null>(null);

const {mutate: deleteNamespace, isPending: isDeletingNamespace, isError: deleteNamespaceError, error: deleteNamespaceErrorData} = useDeleteNamespace(store, closeModal);

const showDiscardConfirm = ref(false);

const validationPassed = computed(() => {
   return confirmDeleteInput.value === namespaceToDelete.value?.meta.name;
});

function openDelete(namespace: Namespace) {
  namespaceToDelete.value = namespace;
  showModal.value = true;
}

function handleModalClose() {
  if (namespaceToDelete.value) {
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
  namespaceToDelete.value = null;
  confirmDeleteInput.value = '';
}

async function onSubmit() {
  if (!namespaceToDelete.value) {
    return;
  }
  deleteNamespace(namespaceToDelete.value.meta.name);
}

defineExpose({ openDelete });
</script>

<template>
    <trailhand-modal
      :open.prop="showModal"
      title="Are you sure?"
      :dismissible="false"
      @modal-open="() => deleteNamespaceInput?.focus()"
      @modal-close="closeModal"
    >
      <div class="modal-content">
        <p>{{ t('epinio.namespace.attemptDelete') }} <strong>{{ namespaceToDelete?.meta.name }}</strong>.</p>
        <Banner
          color="warning"
          :label="t('epinio.namespace.deleteWarning')"
        />  
        <p>{{ t('epinio.namespace.confirmDelete') }} <strong>{{ namespaceToDelete?.meta.name }}</strong>:</p>
        <trailhand-text-input
          ref="deleteNamespaceInput"
          :value="confirmDeleteInput"
          size="large"
          @text-input-change="confirmDeleteInput = $event.detail.value"
          @keydown="(e: KeyboardEvent) => { if (e.key === 'Enter' && validationPassed) onSubmit(); }"
        ></trailhand-text-input>
        <Banner
          v-if="deleteNamespaceError"
          color="error"
          :label="deleteNamespaceErrorData?.message || t('epinio.namespace.errors.delete')"
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
                :disabled="!validationPassed || isDeletingNamespace"
                @button-click="onSubmit"
            >
                {{ isDeletingNamespace ? t('generic.deleting') : t('generic.delete') }}
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
