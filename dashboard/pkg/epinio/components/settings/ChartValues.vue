<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useStore } from 'vuex';
import formRulesGenerator from '@shell/utils/validators/formRules';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';

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

// Store
const store = useStore();

// Reactive data
const valid = ref<{ [key: string]: boolean }>({});

// Watch for changes in `valid`
watch(valid, (newValid) => {
  emit('valid', newValid);
});

// Methods
const rules = (key: string, min: any, max: any) => {
  const frg = formRulesGenerator(store.getters['i18n/t'], { key });
  const minRule = frg.minValue(min);
  const maxRule = frg.maxValue(max);

  return (value: string) => {
    const messages = [];

    if (value) {
      const minRes = minRule(value);
      if (minRes) messages.push(minRes);

      const maxRes = maxRule(value);
      if (maxRes) messages.push(maxRes);
    }

    valid.value[key] = !messages.length;
    return messages.join(',');
  };
};

const numericPlaceholder = (setting: any) => {
  if (setting.maximum && setting.minimum) {
    return `${setting.minimum} to ${setting.maximum}`;
  } else if (setting.maximum) {
    return `<= ${setting.maximum}`;
  } else if (setting.minimum) {
    return `>= ${setting.minimum}`;
  } else {
    return '';
  }
};

const onInputCheckbox = (key: string, value: boolean) => {
  props.value[key] = value ? 'true' : 'false';
};
</script>

<template>
  <div class="chart-values">
    <h3>{{ props.title }}</h3>
    <div v-for="(setting, key) in props.chart" :key="key" class="chart-values-item">
      <LabeledInput
        v-if="setting.type === 'number' || setting.type === 'integer'"
        :id="key"
        v-model:value="props.value[key]"
        :label="key"
        type="number"
        :min="setting.minimum"
        :max="setting.maximum"
        :rules="[rules(key, setting.minimum, setting.maximum)]"
        :tooltip="numericPlaceholder(setting)"
        :mode="props.mode"
        :disabled="props.disabled"
      />
      <Checkbox
        v-else-if="setting.type === 'bool'"
        :id="key"
        :value="props.value[key] === 'true'"
        :label="key"
        :mode="props.mode"
        :disabled="props.disabled"
        @input="onInputCheckbox(key, $event)"
      />
      <LabeledSelect
        v-else-if="setting.type === 'string' && setting.enum"
        :id="key"
        v-model:value="props.value[key]"
        :label="key"
        :options="setting.enum"
        :mode="props.mode"
        :disabled="props.disabled"
      />
      <LabeledInput
        v-else-if="setting.type === 'string'"
        :id="key"
        v-model:value="props.value[key]"
        :label="key"
        :mode="props.mode"
        :disabled="props.disabled"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chart-values {
  display: flex;
  flex-direction: column;

  &-item:not(:last-of-type) {
    margin-bottom: 20px;
  }
}
</style>
