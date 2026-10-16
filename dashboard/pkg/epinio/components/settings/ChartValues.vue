<script lang="ts" setup>
import { watch, computed } from 'vue';
import { ChartSetting } from '../../models/catalogservice/ui-types';

// Props
const props = defineProps<{
  chart: ChartSetting[];
  value: { [key: string]: any };
  title: string;
  mode: string;
  disabled: boolean;
}>();

// Emit function
const emit = defineEmits(['valid']);

const valid = computed(() => {
  return props.chart.every((setting) => {
    if (setting.type !== 'number' && setting.type !== 'integer') {
      return true;
    }

    const rawValue = props.value[setting.name];

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return true;
    }

    const value = Number(rawValue);

    if (Number.isNaN(value)) {
      return false;
    }

    if ((setting.minimum != null && setting.minimum !== undefined) && value < Number(setting.minimum)) {
      return false;
    }

    if ((setting.maximum != null && setting.maximum !== undefined) && value > Number(setting.maximum)) {
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
    <div v-for="(setting) in props.chart" :key="setting.name" class="chart-values-item">
      <trailhand-text-input
        v-if="setting.type === 'number' || setting.type === 'integer'"
        :id="setting.name"
        style="flex: 1;"
        :value="props.value[setting.name]"
        :label="setting.name"
        type="number"
        :min="setting.minimum"
        :max="setting.maximum"
        :disabled="props.disabled"
        @text-input-change="(e: CustomEvent) => props.value[setting.name] = e.detail.value"
       />
      <trailhand-checkbox
        v-else-if="setting.type === 'bool'"
        :id="setting.name"
        :checked="props.value[setting.name] === 'true'"
        :disabled="props.disabled"
        @checkbox-change="(e: CustomEvent) => onInputCheckbox(setting.name, e.detail.checked)"
       >{{ setting.name }}</trailhand-checkbox>
      <trailhand-dropdown
        v-else-if="setting.type === 'string' && setting.enum"
        :id="setting.name"
        style="flex: 1;"
        :value="props.value[setting.name]"
        :label="setting.name"
        :options="setting.enum.map((option: string) => ({ label: option, value: option }))"
        :disabled="props.disabled"
        @dropdown-change="(e: CustomEvent) => props.value[setting.name] = e.detail.value"
       />
       <trailhand-text-input
        v-else-if="setting.type === 'string'"
        :id="setting.name"
        style="flex: 1;"
        :value="props.value[setting.name]"
        :label="setting.name"
        :disabled="props.disabled"
        @text-input-change="(e: CustomEvent) => props.value[setting.name] = e.detail.value"
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
