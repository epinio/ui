<script setup lang="ts">
import { computed, ref, reactive } from 'vue';
import { useStore } from 'vuex';

import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { objValuesToString } from '../../utils/settings';
import Banner from '@components/Banner/Banner.vue';
import ChartValues from '../settings/ChartValues.vue';

import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');

// Form fields (separate from the model to avoid proxy mutation issues)
const chartName = ref('');
const chartShortDescription = ref('');
const chartDescription = ref('');
const helmChartUrl = ref('');
const helmRepoUrl = ref('');
const chartSettings = ref<{ name: string, type: string, default: any }[]>([]);

const saving = ref(false);
const errors = ref<string[]>([]);

const isEdit = computed(() => modalMode.value === 'edit');
const isView = computed(() => modalMode.value === 'view');

const isDirty = computed(() => {
  if (isView.value) return false;

  if (isEdit.value) {
    // 
  }

  return !!(chartName.value || helmChartUrl.value || helmRepoUrl.value);
});

const showDiscardConfirm = ref(false);

const validationPassed = computed(() => {
  if (isEdit.value) {
    if (!serviceModel.value) return false;

    const newSettings = !isEqual(
      objValuesToString(chartValues),
      objValuesToString(serviceModel.value.settings || {})
    );
    const appBindingChanged = !isEqual(
      [...selectedApps.value].sort(),
      [...initialBoundApps.value].sort()
    );

    return newSettings || appBindingChanged;
  }

  if (!formCatalogService.value) return false;
  if (!chartName.value) return false;
  if (!chartShortDescription.value) return false;
  if (!chartDescription.value) return false;
  if (!helmChartUrl.value) return false;
  if (!helmRepoUrl.value) return false;
  if (showChartValues.value && !Object.values(validChartValues.value).every((v) => !!v)) return false;

  const nameErrors = validateKubernetesName(chartName.value, '', store.getters, undefined, []);

  return nameErrors.length === 0 && nsErrors.length === 0;
});

function openCreate(prefilledCatalogService?: string) {
  errors.value = [];
  modalMode.value = 'create';
  chartName.value = '';
  chartShortDescription.value = '';
  chartDescription.value = '';
  helmChartUrl.value = '';
  helmRepoUrl.value = '';
  showModal.value = true;
}

function openView(row: any) {
  errors.value = [];
  modalMode.value = 'view';
  chartName.value = row.name || row.meta?.name || '';
  chartShortDescription.value = row.short_description || '';
  chartDescription.value = row.description || '';
  helmChartUrl.value = row.helm_chart_url || '';
  helmRepoUrl.value = row.helm_repo_url || '';
}

function openEdit(row: any) {
  errors.value = [];
  modalMode.value = 'edit';
  chartName.value = row.name || row.meta?.name || '';
  chartShortDescription.value = row.short_description || '';
  chartDescription.value = row.description || '';
  helmChartUrl.value = row.helm_chart_url || '';
  helmRepoUrl.value = row.helm_repo_url || '';
}

function handleModalClose() {
  if (isDirty.value) {
    showDiscardConfirm.value = true;
  } else {
    closeModal();
  }
}

function handleKeepEditing() {
  showDiscardConfirm.value = false;
}

function handleDiscard() {
  showDiscardConfirm.value = false;
  closeModal();
}

function closeModal() {
  // Clear form state before setting showModal = false so that when Lit fires
  // modal-close (which triggers handleModalClose), isDirty is already false
  chartName.value = '';
  chartShortDescription.value = '';
  chartDescription.value = '';
  helmChartUrl.value = '';
  helmRepoUrl.value = '';
  errors.value = [];
  showDiscardConfirm.value = false;
  showModal.value = false;
}

async function onSubmit() {
  if (!validationPassed.value || saving.value) return;

  saving.value = true;
  errors.value = [];

  // try {
  //   if (!isEdit.value) {
  //     const svc = await store.dispatch('epinio/create', { type: EPINIO_TYPES.SERVICE_INSTANCE });

  //     // Capture values before closeModal() wipes form state
  //     const capturedNamespace = chartNamespace.value;
  //     const capturedName = chartName.value;
  //     const capturedSelectedApps = [...selectedApps.value];

  //     // Create the service instance, then bind apps and refresh in the background
  //     svc.metadata = { namespace: capturedNamespace, name: capturedName };
  //     svc.catalog_service = formCatalogService.value;

  //     const cleanSettings = { ...chartValues };

  //     delete cleanSettings.value;
  //     svc.settings = Object.keys(cleanSettings).length ? objValuesToString(cleanSettings) : undefined;

  //     await svc.create();

  //     // Re-assert metadata: followLink merges the sparse create response back
  //     // into the model, which can wipe metadata and break subsequent bind calls
  //     svc.metadata = { namespace: capturedNamespace, name: capturedName };

  //     closeModal();

  //     // Show the new item quickly, then bind apps and refresh again once done
  //     svc.forceFetch().catch(() => {});
  //     if (capturedSelectedApps.length) {
  //       Promise.all(capturedSelectedApps.map((app: string) => svc.bindApp(app)))
  //         .then(() => svc.forceFetch())
  //         .catch(() => {});
  //     }
  //   } else {
  //     const svc = serviceModel.value;
  //     const newSettings = !isEqual(
  //       objValuesToString(chartValues),
  //       objValuesToString(svc.settings || {})
  //     );

  //     if (newSettings) {
  //       const cleanSettings = { ...chartValues };

  //       delete cleanSettings.value;
  //       svc.settings = objValuesToString(cleanSettings);
  //       await svc.update();
  //     }

  //     const bindApps = selectedApps.value;
  //     const unbindApps = initialBoundApps.value.filter(a => !bindApps.includes(a));
  //     const newBindApps = bindApps.filter(a => !initialBoundApps.value.includes(a));

  //     closeModal();

  //     // Bind/unbind and refresh in the background
  //     Promise.all([
  //       ...newBindApps.map((a: string) => svc.bindApp(a)),
  //       ...unbindApps.map((a: string) => svc.unbindApp(a)),
  //     ]).catch(() => {});
  //     svc.forceFetch().catch(() => {});
  //   }
  // } catch (err: any) {
  //   errors.value = epinioExceptionToErrorsArray(err);
  // } finally {
  //   saving.value = false;
  // }
}

defineExpose({ openCreate, openEdit, openView });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible.prop="false"
    :title="(isEdit || isView) ? chartName : 'App Chart'"
    :subtitle="(isEdit || isView) ? '' : 'Create New'"
    @modal-close="handleModalClose"
  >
    <div class="modal-content" id="modal-container-element">
      <trailhand-form-card>
        <trailhand-form-row columns="2">
          <trailhand-text-input
            :value="chartName"
            label="Name"
            placeholder="A Unique Name"
            :required="true"
            :disabled="isEdit || isView"
            @text-input-change="(e: CustomEvent) => { chartName = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-text-input
            :value="chartShortDescription"
            label="Short Description"
            placeholder="A brief description"
            :required="true"
            :disabled="isEdit || isView"
            @text-input-change="(e: CustomEvent) => { chartShortDescription = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row>
          <trailhand-code-editor
            :value="chartDescription"
            label="Description"
            placeholder="A detailed description"
            :disabled="isEdit || isView"
            required
            @code-input-change="(e: CustomEvent) => { chartDescription = e.detail.value; }"
          />
        </trailhand-form-row>
        <trailhand-form-row columns="2">
          <trailhand-text-input
            :value="helmChartUrl"
            label="Helm Chart URL"
            placeholder="e.g. https://example.com/charts/mychart-0.1.0.tgz"
            :required="true"
            :disabled="isEdit || isView"
            @text-input-change="(e: CustomEvent) => { helmChartUrl = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-text-input
            :value="helmRepoUrl"
            label="Helm Repo URL"
            placeholder="e.g. https://example.com/charts/index.yaml"
            :required="true"
            :disabled="isEdit || isView"
            @text-input-change="(e: CustomEvent) => { helmRepoUrl = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row columns="3" v-for="(setting, index) in chartSettings" :key="index">
          <trailhand-text-input
            :value="setting.name"
            label="Setting Name"
            :disabled="isEdit || isView"
            @text-input-change="(e: CustomEvent) => { chartSettings[index].name = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-dropdown
            :value="setting.type"
            label="Setting Type"
            :options="[{label: 'String', value: 'string'}, {label: 'Number', value: 'number'}, {label: 'Integer', value: 'integer'}, {label: 'Boolean', value: 'bool'}]"
            :disabled="isEdit || isView"
            @dropdown-change="(e: CustomEvent) => { chartSettings[index].type = e.detail.value; }"
          ></trailhand-dropdown>
          <trailhand-text-input
            v-if="setting.type === 'string' || setting.type === 'number' || setting.type === 'integer'"
            :value="setting.default"
            label="Default Value"
            :disabled="isEdit || isView"
            :type="setting.type === 'string' ? 'text' : 'number'"
            @text-input-change="(e: CustomEvent) => { chartSettings[index].default = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-dropdown
            v-else-if="setting.type === 'bool'"
            :value="setting.default"
            label="Default Value"
            :options="[{label: 'True', value: 'true'}, {label: 'False', value: 'false'}]"
            :disabled="isEdit || isView"
            @dropdown-change="(e: CustomEvent) => { chartSettings[index].default = e.detail.value; }"
          ></trailhand-dropdown>
        </trailhand-form-row>
      </trailhand-form-card>
      
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </div>
    <trailhand-button
      variant="secondary"
      @button-click="chartSettings.push({ name: '', type: 'string', default: '' })"
      :disabled="isEdit || isView"
    >
      Add Setting
    </trailhand-button>
    <div slot="footer">
      <template v-if="isView">
        <trailhand-button
          variant="secondary"
          class="mr-10"
          @button-click="closeModal"
        >
          Close
        </trailhand-button>
        <trailhand-button
          variant="primary"
          @button-click="modalMode = 'edit'"
        >
          Edit Configuration
        </trailhand-button>
      </template>
      <template v-else-if="showDiscardConfirm">
        <span class="discard-message">You have unsaved changes.</span>
        <trailhand-button
          variant="secondary"
          class="mr-10"
          @button-click="handleKeepEditing"
        >
          Keep Editing
        </trailhand-button>
        <trailhand-button
          variant="destructive"
          @button-click="handleDiscard"
        >
          Discard
        </trailhand-button>
      </template>
      <template v-else>
        <trailhand-button
          variant="secondary"
          class="mr-10"
          @button-click="handleModalClose"
        >
          Cancel
        </trailhand-button>
        <trailhand-button
          variant="primary"
          :disabled="!validationPassed || saving"
          @button-click="onSubmit"
        >
          {{ saving ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? t('generic.save') : t('generic.create')) }}
        </trailhand-button>
      </template>
    </div>
  </trailhand-modal>
</template>

<style lang="scss" scoped>
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 1000px;
  min-height: 500px;
}

.discard-message {
  font-size: 13px;
  color: var(--body-text);
  margin-right: 12px;
}
</style>
