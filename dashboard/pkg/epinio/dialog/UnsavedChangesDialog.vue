<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import GenericPrompt from '@shell/dialog/GenericPrompt';

const store = useStore();
const t = store.getters['i18n/t'];

const props = defineProps<{
  onProceed?: () => void;
  onCancel?: () => void;
}>();

const emit = defineEmits<{
  (e: 'close'): void
}>();

const genericPrompt = ref<HTMLElement | null>(null);

const handleDiscard = async () => {
  if (props.onProceed) {
    props.onProceed();
  }
  emit('close');
};

const handleClose = () => {
  if (props.onCancel) {
    props.onCancel();
  }
  emit('close');
};

const config = {
  applyMode:   'discard',
  applyAction: handleDiscard,
};
</script>

<template>
  <GenericPrompt
    ref="genericPrompt"
    v-bind="config"
    @close="handleClose"
  >
    <template #title>
      <h4 class="text-default-text">
        {{ t('epinio.unsavedChanges.title') }}
      </h4>
    </template>

    <template #body>
      <p>
        {{ t('epinio.unsavedChanges.message') }}
      </p>
    </template>
  </GenericPrompt>
</template>

<style lang="scss" scoped>
p {
  margin-bottom: 0;
}
</style>
