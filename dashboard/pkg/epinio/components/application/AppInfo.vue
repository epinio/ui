<script lang="ts">
import Vue, { PropType, defineComponent } from 'vue';
import NameNsDescription from '@shell/components/form/NameNsDescription.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import KeyValue from '@shell/components/form/KeyValue.vue';
import ArrayList from '@shell/components/form/ArrayList.vue';
import Loading from '@shell/components/Loading.vue';
import Banner from '@components/Banner/Banner.vue';
import { _EDIT } from '@shell/config/query-params';
import ChartValues from '../settings/ChartValues.vue';

import { sortBy } from '@shell/utils/sort';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { EPINIO_TYPES, EpinioNamespace } from '../../types';
import Application from '../../models/applications';
import { objValuesToString } from '../../utils/settings';

export interface EpinioAppInfo {
  meta: {
    name: string,
    namespace: string
  },
  chart?: {},
  configuration: {
    configurations: string[],
    instances: number,
    environment: { [key: string] : any }
    settings: { [key: string] : any }
    routes: string[]
  }
}

interface Data {
  errors: string[],
  values?: EpinioAppInfo
}

// Data, Methods, Computed, Props
export default defineComponent({

  props: {
    application: {
      type:     Object as PropType<Application>,
      required: true
    },
    mode: {
      type:     String,
      required: true
    },
  },

  data() {
    return {
      errors:        [],
      values:        undefined,
      validSettings: {},
    };
  },

  mounted() {
    const values: EpinioAppInfo = {
      meta: {
        name:      this.application.meta?.name,
        namespace: this.application.meta?.namespace || this.namespaces[0]?.metadata.name
      },
      chart:         this.moveBooleansToFront(this.application.chart?.settings) || {},
      configuration: {
        configurations: this.application.configuration?.configurations || [],
        instances:      this.application.configuration?.instances || 1,
        environment:    this.application.configuration?.environment || {},
        settings:       this.application.configuration?.settings || {},
        routes:         this.application.configuration?.routes || [],
      },
    };

    this.values = values;

    this.validSettings = {};

    this.$emit('valid', this.valid);

    this.populateOnEdit();
  },

  watch: {
    'values.configuration.instances'() {
      this.update();
    },

    'values.configuration.environment'() {
      this.update();
    },

    'values.configuration.settings': {
      handler() {
        this.update();
      },
      deep: true
    },

    'values.configuration.routes'() {
      this.update();
    },

    valid() {
      this.$emit('valid', this.valid);
    }
  },

  computed: {
    namespaces() {
      return sortBy(this.$store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE), 'name', false);
    },

    namespaceNames() {
      return this.namespaces.map((n: EpinioNamespace) => n.metadata.name);
    },

    valid() {
      if (!this.values) {
        return false;
      }
      const validName = !!this.values.meta?.name;

      const nsErrors = validateKubernetesName(this.values.meta?.namespace || '', '', this.$store.getters, undefined, []);
      const validNamespace = nsErrors.length === 0;
      const validInstances = typeof this.values.configuration?.instances !== 'string' && this.values.configuration?.instances >= 0;

      return validName && validNamespace && validInstances && Object.values(this.validSettings).every((v) => !!v);
    },

    showApplicationVariables() {
      return Object.keys(this.values?.configuration?.settings).length !== 0;
    },

    isEdit() {
      return this.mode === _EDIT;
    },
  },

  methods: {
    update() {
      this.$emit('change', {
        meta:          this.values.meta,
        configuration: {
          ...this.values.configuration,
          settings: objValuesToString(this.values.configuration.settings)
        },
      });
    },

    async populateOnEdit() {
      // We need to fetch the chart settings on edit mode.
      if (this.mode === 'edit' || this.mode === 'view') {
        const chartList = await this.$store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP_CHARTS });

        const filterChart = chartList?.find((chart: any) => chart.id === this.application.configuration.appchart);

        if (filterChart?.settings ) {
          const customValues = Object.keys(filterChart?.settings).reduce((acc:any, key: any) => {
            acc[key] = this.application.configuration.settings[key] || '';

            return acc;
          }, {});

          this.values.configuration.settings = customValues;
          this.values.chart = this.moveBooleansToFront(filterChart.settings);
        }
      }
    },

    // Allows us to move the checkbox at the top of the list so layout-wise looks better
    moveBooleansToFront(settingsObj: any) {
      if (!settingsObj) {
        return;
      }
      const entries = Object.entries(settingsObj);

      entries.sort((a: any, b: any) => {
        const aValue = a[1].type === 'bool' ? 0 : 1;
        const bValue = b[1].type === 'bool' ? 0 : 1;

        return aValue - bValue;
      });

      return Object.fromEntries(entries);
    },
  },

});
</script>

<template>
  <Loading v-if="!values" />
  <div v-else>
    <div class="col">
      <NameNsDescription
        data-testid="epinio_app-info_name-ns"
        name-key="name"
        namespace-key="namespace"
        :namespaces-override="namespaceNames"
        :create-namespace-override="true"
        :description-hidden="true"
        :value="values.meta"
        :mode="mode"
        @change="update"
        @createNamespace="ns => values.meta.namespace = ns"
      />
    </div>
    <div class="col span-6">
      <LabeledInput
        v-model.number="values.configuration.instances"
        data-testid="epinio_app-info_instances"
        type="number"
        min="0"
        required
        :mode="mode"
        :label="t('epinio.applications.create.instances')"
      />
    </div>
    <div class="spacer" />
    <div class="col span-8">
      <ArrayList
        v-model:value="values.configuration.routes"
        data-testid="epinio_app-info_routes"
        :title="t('epinio.applications.create.routes.title')"
        :protip="t('epinio.applications.create.routes.tooltip')"
        :mode="mode"
        :value-placeholder="t('epinio.applications.create.routes.placeholder')"
      />
    </div>
    <div class="spacer" />
    <div
      v-if="isEdit"
      class="col span-8"
    >
      <Banner
        color="info"
      >
        {{ t('epinio.applications.create.settingsVars.description') }}
      </Banner>
    </div>
    <div
      v-if="showApplicationVariables"
      class="col span-6"
    >
      <ChartValues
        v-model:value="values.configuration.settings"
        :chart="values.chart"
        :title="t('epinio.applications.create.settingsVars.title')"
        :mode="mode"
        @valid="validSettings = $event"
      />
      <div class="spacer" />
    </div>
    <div class="col span-8">
      <KeyValue
        v-model:value="values.configuration.environment"
        data-testid="epinio_app-info_envs"
        :mode="mode"
        :title="t('epinio.applications.create.envvar.title')"
        :key-label="t('epinio.applications.create.envvar.keyLabel')"
        :value-label="t('epinio.applications.create.envvar.valueLabel')"
        :parse-lines-from-file="true"
      />
      <div class="mb-20" /> <!-- allow a small amount of padding at bottom -->
    </div>
  </div>
</template>
