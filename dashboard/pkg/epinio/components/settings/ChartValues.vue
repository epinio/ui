<script lang="ts">
import Vue, { PropType } from 'vue';
import formRulesGenerator from '@shell/utils/validators/formRules';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import KeyValue from '@shell/components/form/KeyValue.vue';
import ArrayList from '@shell/components/form/ArrayList.vue';
import { _VIEW } from '@shell/config/query-params';

interface Data {
  valid: { [key: string]: boolean }
}

// Data, Methods, Computed, Props
export default Vue.extend<Data, any, any, any>({
  components: {
    ArrayList,
    Checkbox,
    LabeledInput,
    LabeledSelect,
    KeyValue
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
    return {
      valid: {},
      VIEW:  _VIEW,
    };
  },

  watch: {
    valid(neu) {
      this.$emit('valid', neu);
    }
  },

  mounted() {
    console.log(this.chart, this.value);
  },

  computed: {
    orderedChart() {
      const toArray = (value: any, type: string) => Object.keys(value)
        .filter((k) => value[k].type === type)
        .reduce((acc: any[], key: any) => {
          return [
            ...acc,
            { name: key, type: value[key].type }
          ];
        }, []);

      return [
        ...toArray(this.chart, 'bool'),
        ...toArray(this.chart, 'string'),
        ...toArray(this.chart, 'map'),
        ...toArray({ ...this.chart, 'example.array': { type: 'array' } }, 'array'),
      ];
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

    onInputCheckbox(key: string, value: boolean) {
      Vue.set(this.value, key, value ? 'true' : 'false');
    },

    setMapValue(v: any) {
      console.log(v)
    },
    setArrayValue(v: any) {
      console.log(v)
    }
  },
});
</script>

<template>
  <div class="chart-values">
    <h3>{{ title }}</h3>
    <div
      v-for="setting in orderedChart"
      :key="setting.name"
      class="chart-values-item"
    >
      <LabeledInput
        v-if="setting.type === 'number' || setting.type === 'integer'"
        :id="setting.name"
        v-model="value[setting.name]"
        :label="setting.name"
        type="number"
        :min="setting.minimum"
        :max="setting.maximum"
        :rules="[rules(setting.name, setting.minimum, setting.maximum)]"
        :tooltip="numericPlaceholder(setting)"
        :mode="mode"
        :disabled="disabled"
      />
      <Checkbox
        v-else-if="setting.type === 'bool'"
        :id="setting.name"
        :value="value[setting.name] === 'true'"
        :label="setting.name"
        :mode="mode"
        :disabled="disabled"
        @input="onInputCheckbox(setting.name, $event)"
      />
      <LabeledSelect
        v-else-if="setting.type === 'string' && setting.enum"
        :id="setting.name"
        v-model="value[setting.name]"
        :label="setting.name"
        :options="setting.enum"
        :mode="mode"
        :disabled="disabled"
      />
      <LabeledInput
        v-else-if="setting.type === 'string'"
        :id="setting.name"
        v-model="value[setting.name]"
        :label="setting.name"
        :mode="mode"
        :disabled="disabled"
      />
      <KeyValue
        v-else-if="setting.type === 'map'"
        v-model="value[setting.name]"
        :title="setting.name"
        :initial-empty-row="mode !== VIEW"
        :mode="mode"
        :key-label="t('epinio.applications.create.envvar.keyLabel')"
        :value-label="t('epinio.applications.create.envvar.valueLabel')"
        :parse-lines-from-file="false"
        @input="setMapValue($event)"
      />
      <ArrayList
        v-else-if="setting.type === 'array'"
        v-model="value[setting.name]"
        :title="setting.name"
        :mode="mode"
        @input="setArrayValue($event)"
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
