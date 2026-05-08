<script setup lang="ts">
import { ref, watch } from 'vue';
import { useStore } from 'vuex';
import { Card } from '@components/Card';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';

interface Props {
  show: boolean;
  title: string;
  itemLabels: string[];
  deleting?: boolean;
  showDeleteImage?: boolean;
  description?: string;
}

const props = withDefaults(defineProps<Props>(), {
  deleting: false,
  showDeleteImage: false,
  description: ''
});

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'confirm', payload: { deleteImage: boolean }): void;
}>();

const deleteImage = ref(false);
const store = useStore();
const t = store.getters['i18n/t'];

watch(() => props.show, (show) => {
  if (!show) {
    deleteImage.value = false;
  }
});

function onConfirm() {
  emit('confirm', { deleteImage: deleteImage.value });
}
</script>

<template>
  <div
    v-if="show"
    class="modal"
  >
    <Card
      class="modal-content"
      :show-actions="true"
    >
      <template #title>
        <h4>{{ title }}</h4>
      </template>
      <template #body>
        <p class="mb-10">{{ description }}</p>
        <ul class="delete-list">
          <li
            v-for="label in itemLabels"
            :key="label"
          >
            {{ label }}
          </li>
        </ul>
        <div
          v-if="showDeleteImage"
          class="mt-20"
        >
          <Checkbox
            v-model:value="deleteImage"
            :label="t('epinio.applications.deleteImage.label')"
          />
        </div>
      </template>
      <template #actions>
        <div class="modal-actions">
          <button
            class="btn role-secondary mr-10"
            :disabled="deleting"
            @click="$emit('close')"
          >
            {{ t('generic.cancel') }}
          </button>
          <button
            class="btn bulk-delete-confirm-btn"
            :disabled="deleting || itemLabels.length === 0"
            @click="onConfirm"
          >
            {{ deleting ? t('epinio.bulkDelete.deletingAction') : t('epinio.bulkDelete.confirmAction', { count: itemLabels.length }) }}
          </button>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped lang="scss">
.modal {
  position: fixed;
  z-index: 50;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgba(0, 0, 0, 0.4);
  border-radius: var(--border-radius);
}

.modal-content {
  background-color: var(--default);
  margin: 10% auto;
  padding: 20px;
  border: 1px solid #888;
  width: 50%;
  max-width: 650px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
}

.delete-list {
  max-height: 220px;
  overflow: auto;
  margin: 0;
  padding-left: 20px;
}

.bulk-delete-confirm-btn:disabled {
  background-color: var(--disabled-bg) !important;
  border-color: var(--border) !important;
  color: var(--disabled-text) !important;
  opacity: 1;
}

.bulk-delete-confirm-btn:not(:disabled) {
  background-color: var(--error) !important;
  border-color: var(--error) !important;
  color: var(--error-contrast, #fff) !important;
}

.bulk-delete-confirm-btn:not(:disabled):hover {
  filter: brightness(0.92);
}
</style>
