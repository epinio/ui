<script setup lang="ts">
import { computed } from 'vue';
import { Codemirror } from 'vue-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';
import { lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';

const props = defineProps<{
  value: string;
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:value', value: string): void;
}>();

const extensions = computed(() => [
  yaml(),
  oneDark,
  lintGutter(),
  EditorView.lineWrapping,
  EditorView.editable.of(!props.disabled),
]);

function handleChange(value: string) {
  emit('update:value', value);
}
</script>

<template>
  <div class="yaml-editor" :class="{ 'yaml-editor--disabled': disabled }">
    <Codemirror
      :value="value"
      :extensions="extensions"
      :placeholder="placeholder"
      :style="{ height: '300px' }"
      :disabled="disabled"
      @change="handleChange"
    />
  </div>
</template>

<style lang="scss" scoped>
.yaml-editor {
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  overflow: hidden;

  &--disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  :deep(.cm-editor) {
    height: 100%;
    font-family: var(--font-monospace, monospace);
    font-size: 0.875rem;
  }

  :deep(.cm-scroller) {
    overflow: auto;
  }
}
</style>