<script lang="ts" setup>
import { ref, watch, computed } from 'vue';

// Props
const props = defineProps<{
  chart: { [key: string]: any };
  value: { [key: string]: any };
  title: string;
  mode: string;
  disabled: boolean;
}>();

console.log('ChartValues props:', props); // Debug log to check props

// Emit function
const emit = defineEmits(['valid']);

const valid = computed(() => {
  return Object.entries(props.chart).every(([key, setting]: [string, any]) => {
    if (setting.type !== 'number' && setting.type !== 'integer') {
      return true;
    }

    const rawValue = props.value[key];

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return true;
    }

    const value = Number(rawValue);

    if (Number.isNaN(value)) {
      return false;
    }

    if ((setting.minimum != null && setting.minimum !== '' && setting.minimum !== undefined) && value < Number(setting.minimum)) {
      return false;
    }

    if ((setting.maximum != null && setting.maximum !== '' && setting.maximum !== undefined) && value > Number(setting.maximum)) {
      return false;
    }

    return true;
  });
})

watch(valid, (isValid) => {
  emit("valid", isValid);
}, { immediate: true });

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
        :checked="props.value[key] === 'true'"
        :disabled="props.disabled"
        @checkbox-change="(e: CustomEvent) => onInputCheckbox(key, e.detail.checked)"
       >{{ key }}</trailhand-checkbox>
      <trailhand-dropdown
        v-else-if="setting.type === 'string' && setting.enum"
        :id="key"
        style="flex: 1;"
        :value="props.value[key]"
        :label="key"
        :options="setting.enum.map((option: string) => ({ label: option, value: option }))"
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
