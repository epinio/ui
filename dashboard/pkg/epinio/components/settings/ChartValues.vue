<script lang="ts">
import Vue, { PropType } from 'vue';
import formRulesGenerator from '@shell/utils/validators/formRules';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';

interface Data {
  valid: { [key: string]: boolean }
}

// Data, Methods, Computed, Props
export default Vue.extend<Data, any, any, any>({
  components: {
    Checkbox,
    LabeledInput,
    LabeledSelect,
  },

  props: {
    chart: {
      type:     Object as PropType<{ [key: string]: object }>,
      required: true
    },
    value: {
      type:     Object as PropType<{ [key: string]: any }>,
      required: true
    },
    title: {
      type:    String,
      default: 'Settings'
    },
    mode: {
      type:     String,
      required: true
    },
    disabled: {
      type:    Boolean,
      default: false
    },
  },

  data() {
    return { valid: {} };
  },

  watch: {
    valid(neu) {
      this.$emit('valid', neu);
    }
  },

  methods: {
    rules(key: string, min: any, max: any) {
      const frg = formRulesGenerator(this.$store.getters['i18n/t'], { key });
      const minRule = frg.minValue(min);
      const maxRule = frg.maxValue(max);

      return (value: string) => {
        const messages = [];

        if (value) {
          const minRes = minRule(value);

          if (minRes) {
            messages.push(minRes);
          }

          const maxRes = maxRule(value);

          if (maxRes) {
            messages.push(maxRes);
          }
        }
        Vue.set(this.valid, key, !messages.length);

        return messages.join(',');
      };
    },

    numericPlaceholder(setting: any) {
      if (setting.maximum && setting.minimum) {
        return `${ setting.minimum } to ${ setting.maximum }`;
      } else if (setting.maximum) {
        return `<= ${ setting.maximum }`;
      } else if (setting.minimum) {
        return `>= ${ setting.minimum }`;
      } else {
        return '';
      }
    },
  },
});
</script>

<template>
  <div class="chart-values">
    <h3>{{ title }}</h3>
    <div
      v-for="(setting, key) in chart"
      :key="key"
      class="chart-values-item"
    >
      <LabeledInput
        v-if="setting.type === 'number' || setting.type === 'integer'"
        :id="key"
        v-model="value[key]"
        :label="key"
        type="number"
        :min="setting.minimum"
        :max="setting.maximum"
        :rules="[rules(key, setting.minimum, setting.maximum)]"
        :tooltip="numericPlaceholder(setting)"
        :mode="mode"
        :disabled="disabled"
      />
      <Checkbox
        v-else-if="setting.type === 'bool'"
        :id="key"
        :value="value[key] === 'true'"
        :label="key"
        :mode="mode"
        :disabled="disabled"
        @input="value[key] = $event ? 'true' : 'false'"
      />
      <LabeledSelect
        v-else-if="setting.type === 'string' && setting.enum"
        :id="key"
        v-model="value[key]"
        :label="key"
        :options="setting.enum"
        :mode="mode"
        :disabled="disabled"
      />
      <LabeledInput
        v-else-if="setting.type === 'string'"
        :id="key"
        v-model="value[key]"
        :label="key"
        :mode="mode"
        :disabled="disabled"
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
