<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import { AppPodInfo } from '../models/application/ui-types';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);

const appPodInfo = ref<AppPodInfo | null>(null);

function openModal(pod: AppPodInfo) {
  appPodInfo.value = pod;
  showModal.value = true;
}

function handleModalClose() {
  closeModal();
}


function closeModal() {
  showModal.value = false;
  appPodInfo.value = null;
}

defineExpose({ openModal });
</script>

<template>
    <trailhand-modal
      :open.prop="showModal"
      :title="appPodInfo?.name"
      :dismissible="false"
      :show-dismiss-button="true"
      @escape-key-press="handleModalClose"
      @backdrop-click="handleModalClose"
      @close-button-click="handleModalClose"
    >
      <div class="modal-content">
        <trailhand-banner
            variant="error"
            :title="appPodInfo?.failureReason"
        ></trailhand-banner>
      </div>
      <div slot="footer">
        <trailhand-button
            variant="secondary"
            class="mr-10"
            @button-click="handleModalClose"
        >
            {{ t('generic.close') }}
        </trailhand-button>
      </div>
    </trailhand-modal>
</template>

<style lang="scss" scoped>
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 100%;
}

.discard-message {
  font-size: 13px;
  color: var(--body-text);
  margin-right: 12px;
}
</style>
