<script lang="ts" setup>
import { ref, watch } from 'vue';

// Props
const props = defineProps<{
  chart: { [key: string]: object };
  value: { [key: string]: any };
  title: string;
  mode: string;
  disabled: boolean;
}>();

// Emit function
const emit = defineEmits(['valid']);

// Reactive data
const valid = ref<{ [key: string]: boolean }>({});

// Watch for changes in `valid`
watch(valid, (newValid) => {
  emit('valid', newValid);
});

const onInputCheckbox = (key: string, value: boolean) => {
  props.value[key] = value ? 'true' : 'false';
};
</script>

<template>
  <div class="chart-values">
    <div v-for="(setting, key) in props.chart" :key="key" class="chart-values-item">
      <trailhand-text-input
        v-if="setting.type === 'number' || setting.type === 'integer'"
        :id="key"
        style="flex: 1;"
        :value="props.value[key]"
        :label="key"
        type="number"
        :min="setting.minimum"
        :max="setting.maximum"
        :disabled="props.disabled"
        @text-input-change="(e: CustomEvent) => props.value[key] = e.detail.value"
       />
      <trailhand-checkbox
        v-else-if="setting.type === 'bool'"
        :id="key"
        :value="props.value[key] === 'true'"
        :label="key"
        :disabled="props.disabled"
        @checkbox-change="(e: CustomEvent) => onInputCheckbox(key, e.detail.value)"
       />
      <trailhand-dropdown
        v-else-if="setting.type === 'string' && setting.enum"
        :id="key"
        style="flex: 1;"
        :value="props.value[key]"
        :label="key"
        :options="setting.enum"
        :disabled="props.disabled"
        @dropdown-change="(e: CustomEvent) => props.value[key] = e.detail.value"
       />
       <trailhand-text-input
        v-else-if="setting.type === 'string'"
        :id="key"
        style="flex: 1;"
        :value="props.value[key]"
        :label="key"
        :disabled="props.disabled"
        @text-input-change="(e: CustomEvent) => props.value[key] = e.detail.value"
       />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chart-values {
  display: flex;
  flex-direction: column;
  width: 100%;

  .chart-values-item {
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  &-item:not(:last-of-type) {
    margin-bottom: 20px;
  }
}
</style>
