<script lang="ts">
import Vue, { PropType } from 'vue';
import CreateEditView from '@shell/mixins/create-edit-view';
import Loading from '@shell/components/Loading.vue';
import CruResource from '@shell/components/CruResource.vue';
import NameNsDescription from '@shell/components/form/NameNsDescription.vue';
import { mapGetters } from 'vuex';
import { EpinioCompRecord, EpinioGitConfig } from '../types';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { LabeledInput } from '@components/Form/LabeledInput';
import { _CREATE } from '@shell/config/query-params';
import { Checkbox } from '@components/Form/Checkbox';

interface Data {
}

// https://github.com/epinio/epinio/blob/a3c16e3e085652db7eef8f4bc51e88d1cfdfe265/internal/cli/cmd/gitconfigs.go#L113C1-L113C1
const GIT_CONFIG_PROVIDERS = {
  GIT:               'git',
  GITHUB:            'github',
  GITHUB_ENTERPRISE: 'github_enterprise',
  GITLAB:            'gitlab',
  GITLAB_ENTERPRISE: 'gitlab_enterprise'
};

export default Vue.extend<Data, EpinioCompRecord, EpinioCompRecord, EpinioCompRecord>({
  components: {
    Loading,
    CruResource,
    NameNsDescription,
    Checkbox,
    LabeledSelect,
    LabeledInput
  },

  mixins: [CreateEditView],

  props: {
    mode: {
      type:     String,
      required: true
    },
    value: {
      type:     Object as PropType<EpinioGitConfig>,
      required: true
    },
    initialValue: {
      type:     Object as PropType<EpinioGitConfig>,
      required: true
    }
  },

  async fetch() {
    if (this.mode === _CREATE) {
      this.value.provider = GIT_CONFIG_PROVIDERS.GIT;
    }
  },

  data() {
    return {
      errors:           [],
      validationPassed: false,
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    providers() {
      return Object.entries(GIT_CONFIG_PROVIDERS).map(([pKey, pValue]) => ({
        label: this.t(`epinio.gitconfigs.providers.${ pKey }`),
        value: pValue
      }));
    },

    urlDisabled() {
      return this.value.provider === GIT_CONFIG_PROVIDERS.GITHUB || this.value.provider === GIT_CONFIG_PROVIDERS.GITLAB;
    }

  },

  methods: {
    async save(saveCb: (success: boolean) => void) {
      this.errors = [];
      try {
        if (this.isCreate) {
          await this.value.create();
          await this.$store.dispatch('epinio/findAll', { type: this.value.type, opt: { force: true } });
        }

        if (this.isEdit) {
          await this.value.update();
          await this.value.forceFetch();
        }

        saveCb(true);
        this.done();
      } catch (err) {
        this.errors = epinioExceptionToErrorsArray(err);
        saveCb(false);
      }
    },

    updateValidation() {
      const nameErrors = validateKubernetesName(this.value?.meta.name || '', this.t('epinio.namespace.name'), this.$store.getters, undefined, []);

      Vue.set(this, 'validationPassed', nameErrors.length === 0 && !!this.value.provider && !!this.value.url);
    }

  },

  watch: {
    'value.provider'(neu, old) {
      if (neu === GIT_CONFIG_PROVIDERS.GITHUB) {
        Vue.set(this.value, 'url', `https://github.com`);
        Vue.set(this.value, 'skipsll', false);
      } else if (neu === GIT_CONFIG_PROVIDERS.GITLAB) {
        Vue.set(this.value, 'url', `https://gitlab.com`); // TODO: RC
        Vue.set(this.value, 'skipsll', false);
      } else if (old === GIT_CONFIG_PROVIDERS.GITHUB || old === GIT_CONFIG_PROVIDERS.GITLAB) {
        Vue.set(this.value, 'url', '');
      }
    },

    'value.meta.name'() {
      this.updateValidation();
    },

    'value.url'() {
      this.updateValidation();
    },
  }
});
</script>

<template>
  <Loading v-if="!value || $fetchState.pending" />
  <CruResource
    v-else-if="value"
    :min-height="'7em'"
    :mode="mode"
    :done-route="doneRoute"
    :resource="value"
    :can-yaml="false"
    :errors="errors"
    :validation-passed="validationPassed"
    namespace-key="meta.namespace"
    @error="(e) => (errors = e)"
    @finish="save"
    @cancel="done"
  >
    <!-- {{ JSON.stringify(value) }}<br> -->

    <NameNsDescription
      name-key="name"
      :namespaced="false"
      :description-hidden="true"
      :value="value.meta"
      :mode="mode"
    />
    <h3 class="mt-20">
      {{ t('epinio.gitconfigs.sections.git') }}
    </h3>
    <div class="row">
      <div class="col span-2">
        <!-- Provider -->
        <LabeledSelect
          v-model="value.provider"
          :options="providers"
          :searchable="true"
          :mode="mode"
          :required="true"
          :label-key="'epinio.gitconfigs.tableHeaders.provider.label'"
          :tooltip="t('epinio.gitconfigs.tableHeaders.provider.tooltip')"
        />
      </div>
      <div class="col span-4">
        <!-- URL -->
        <LabeledInput
          v-model="value.url"
          :disabled="urlDisabled"
          :label-key="'epinio.gitconfigs.tableHeaders.url.label'"
          :tooltip="t('epinio.gitconfigs.tableHeaders.url.tooltip')"
          :mode="mode"
          :required="true"
        />
        <!-- :rules="rules.name" -- TODO: RC> -->
      </div>
      <div class="col span-1">
        <!-- skipssl -->
        <Checkbox
          v-model="value.skipssl"
          :disabled="urlDisabled"
          :label-key="'epinio.gitconfigs.tableHeaders.skipssl.label'"
          :tooltip="t('epinio.gitconfigs.tableHeaders.skipssl.tooltip')"
          :mode="mode"
        />
        <!-- :rules="rules.name" -- TODO: RC> -->
      </div>
    </div>
    <div class="spacer" />
    <div class="row">
      <div class="col span-4">
        <!-- repository -->
        <LabeledInput
          v-model="value.repository"
          :label-key="'epinio.gitconfigs.tableHeaders.repository.label'"
          :tooltip="t('epinio.gitconfigs.tableHeaders.repository.tooltip')"
          :mode="mode"
        />
        <!-- :rules="rules.name" -- TODO: RC> -->
      </div>
      <div class="col span-4">
        <!-- userorg -->
        <LabeledInput
          v-model="value.userorg"
          :label-key="'epinio.gitconfigs.tableHeaders.userorg.label'"
          :tooltip="t('epinio.gitconfigs.tableHeaders.userorg.tooltip')"
          :mode="mode"
        />
        <!-- :rules="rules.name" -- TODO: RC> -->
      </div>
    </div>
    <div class="spacer" />
    <h3>
      {{ t('epinio.gitconfigs.sections.credentials') }}
    </h3>
    <div class="row">
      <div
        v-if="!isView"
        class="col span-4"
      >
        <!-- password -->
        <LabeledInput
          v-model="value.password"
          :label-key="'epinio.gitconfigs.password.label'"
          :tooltip="t('epinio.gitconfigs.password.tooltip')"
          :mode="mode"
          :required="true"
        />
        <!-- :rules="rules.name" -- TODO: RC> -->
      </div>
      <div class="col span-4">
        <!-- username -->
        <LabeledInput
          v-model="value.username"
          :label-key="'epinio.gitconfigs.tableHeaders.username.label'"
          :tooltip="t('epinio.gitconfigs.tableHeaders.username.tooltip')"
          :mode="mode"
        />
        <!-- :rules="rules.name" -- TODO: RC> -->
      </div>
    </div>
  </CruResource>
</template>

<style lang='scss' scoped>
  .row {
    display: flex;
    align-items: center;
  }
</style>
