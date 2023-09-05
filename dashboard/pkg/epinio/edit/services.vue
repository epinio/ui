<script lang="ts">
import Vue, { PropType } from 'vue';
import ServiceInstance from '../models/services';
import CreateEditView from '@shell/mixins/create-edit-view';
import CruResource from '@shell/components/CruResource.vue';
import Loading from '@shell/components/Loading.vue';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { EPINIO_TYPES, EpinioNamespace, EpinioCompRecord, EpinioCatalogService } from '../types';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import NameNsDescription from '@shell/components/form/NameNsDescription.vue';
import ChartValues from '../components/settings/ChartValues.vue';
import EpinioBindAppsMixin from './bind-apps-mixin.js';
import { mapGetters } from 'vuex';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';
import EpinioCatalogServiceModel from '../models/catalogservices';
import { objValuesToString } from '../utils/settings';

export const EPINIO_SERVICE_PARAM = 'service';

interface Data {
}

// Data, Methods, Computed, Props
export default Vue.extend<Data, EpinioCompRecord, EpinioCompRecord, EpinioCompRecord>({
  components: {
    Loading,
    ChartValues,
    CruResource,
    LabeledSelect,
    NameNsDescription,
  },

  mixins: [CreateEditView, EpinioBindAppsMixin],

  props: {
    value: {
      type:     Object as PropType<ServiceInstance>,
      required: true
    },
    initialValue: {
      type:     Object as PropType<ServiceInstance>,
      required: true
    },
    mode: {
      type:     String,
      required: true
    },
  },

  async fetch() {
    await Promise.all([
      this.$store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CATALOG_SERVICE }),
      this.mixinFetch()
    ]);

    Vue.set(this.value, 'catalog_service', this.selectedCatalogService?.meta.name || this.$route.query[EPINIO_SERVICE_PARAM] || null);
    Vue.set(this.value.meta, 'namespace', this.initialValue.meta.namespace || this.namespaces[0]?.meta.name);
  },

  data() {
    return {
      errors:                          [],
      failedWaitingForServiceInstance: false,
      selectedApps:                    this.value.boundapps || [],
      chartValues:                     this.value.settings || {},
      validChartValues:                {}
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    validationPassed() {
      if (this.isEdit && this.newBinds) {
        return true;
      }

      if (!this.value.catalog_service) {
        return false;
      }

      if (!Object.values(this.validChartValues).every((v) => !!v)) {
        return false;
      }

      const nameErrors = validateKubernetesName(this.value?.name || '', this.t('epinio.namespace.name'), this.$store.getters, undefined, []);
      const nsErrors = validateKubernetesName(this.value?.meta.namespace || '', '', this.$store.getters, undefined, []);

      if (nameErrors.length === 0 && nsErrors.length === 0) {
        return !this.failedWaitingForServiceInstance;
      }

      return false;
    },

    namespaces() {
      return sortBy(this.$store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE), 'name');
    },

    namespaceNames() {
      return this.namespaces.map((n: EpinioNamespace) => n.metadata.name);
    },

    catalogServices(): EpinioCatalogServiceModel[] {
      return this.$store.getters['epinio/all'](EPINIO_TYPES.CATALOG_SERVICE);
    },

    catalogServiceOpts() {
      return this.catalogServices.map((cs: EpinioCatalogService) => ({
        label: `${ cs.name } (${ cs.short_description })`,
        value: cs.name
      }));
    },

    noCatalogServices() {
      return this.catalogServices.length === 0;
    },

    selectedCatalogService() {
      return this.catalogServices?.find(({ name }: EpinioCatalogServiceModel) => name === this.value.catalog_service);
    },

    newBinds() {
      return !isEqual(sortBy(this.selectedApps), sortBy(this.value.boundapps));
    },

    showChartValues() {
      return Object.keys(this.selectedCatalogService?.settings || {}).length !== 0;
    }
  },

  methods: {
    async save(saveCb: (success: boolean) => void) {
      this.errors = [];
      try {
        if (this.isCreate) {
          await this.value.create();
          if (this.selectedApps.length) {
            await this.updateServiceInstanceAppBindings(this.value);
          }
          await this.$store.dispatch('epinio/findAll', { type: this.value.type, opt: { force: true } });
        }

        if (this.isEdit) {
          await this.updateServiceInstanceAppBindings(this.value);
          await this.value.forceFetch();
        }

        if (!this._isBeingDestroyed || !this._isDestroyed) {
          saveCb(true);
          this.done();
        }
      } catch (err: Error | any) {
        if (err.message === 'waitingForServiceInstance') {
          Vue.set(this, 'failedWaitingForServiceInstance', true);
          this.errors = [this.t('epinio.serviceInstance.create.catalogService.failedWaitingForServiceInstance')];
        } else {
          this.errors = epinioExceptionToErrorsArray(err);
        }
        saveCb(false);
      }
    },
    resetChartValues() {
      this.chartValues = {};
      this.value.settings = null;
      this.validChartValues = {};
    }
  },

  watch: {
    'value.meta.namespace'() {
      Vue.set(this, 'selectedApps', []);
    },
    chartValues: {
      handler(neu) {
        this.value.settings = objValuesToString(neu);
      },
      deep: true
    }
  }

});
</script>

<template>
  <Loading v-if="!value || $fetchState.pending" />
  <CruResource
    v-else-if="value"
    :can-yaml="false"
    :done-route="doneRoute"
    :mode="mode"
    :validation-passed="validationPassed"
    :resource="value"
    :errors="errors"
    namespace-key="meta.namespace"
    @error="e=>errors = e"
    @finish="save"
  >
    <NameNsDescription
      name-key="name"
      namespace-key="namespace"
      :namespaces-override="namespaceNames"
      :create-namespace-override="true"
      :description-hidden="true"
      :value="value.meta"
      :mode="mode"
    />
    <div class="row">
      <div class="col span-6">
        <LabeledSelect
          v-model="value.catalog_service"
          :loading="$fetchState.pending"
          :options="catalogServiceOpts"
          :disabled="$fetchState.pending || isEdit"
          :searchable="true"
          :mode="mode"
          :multiple="false"
          :label-key="'epinio.serviceInstance.create.catalogService.label'"
          :placeholder="$fetchState.pending || noCatalogServices ? t('epinio.serviceInstance.create.catalogService.placeholderNoOptions') : t('epinio.serviceInstance.create.catalogService.placeholderWithOptions')"
          required
          @option:selected="resetChartValues"
        />
      </div>
    </div>
    <div class="spacer" />
    <div class="row">
      <div class="col span-6">
        <LabeledSelect
          v-model="selectedApps"
          :loading="$fetchState.pending"
          :options="nsAppOptions"
          :disabled="noApps || $fetchState.pending"
          :searchable="true"
          :mode="mode"
          :multiple="true"
          :label-key="'epinio.configurations.bindApps.label'"
          :placeholder="$fetchState.pending || noApps ? t('epinio.configurations.bindApps.placeholderNoOptions') : t('epinio.configurations.bindApps.placeholderWithOptions')"
        />
      </div>
    </div>
    <div
      v-if="showChartValues"
      class="row"
    >
      <div class="col span-6">
        <div class="spacer" />
        <!-- EDIT mode is not supported -->
        <ChartValues
          v-model="chartValues"
          :chart="selectedCatalogService.settings"
          :title="t('epinio.services.chartValues.title')"
          :mode="mode"
          :disabled="mode === 'edit'"
          @valid="validChartValues = $event"
        />
      </div>
    </div>
  </CruResource>
</template>
