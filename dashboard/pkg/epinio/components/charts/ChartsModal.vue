<script setup lang="ts">
import { computed, ref, reactive } from 'vue';
import { useStore } from 'vuex';

import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { objValuesToString } from '../../utils/settings';
import Banner from '@components/Banner/Banner.vue';
import ChartValues from '../settings/ChartValues.vue';
import EpinioAppChartModel from '../../models/appcharts';

import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');

const initialValues = ref<EpinioAppChartModel | null>(null);

// Form fields (separate from the model to avoid proxy mutation issues)
const chartName = ref('');
const chartShortDescription = ref('');
const chartDescription = ref('');
const helmChartUrl = ref('');
const helmRepoUrl = ref('');
const chartSettings = ref<{ name: string, type: string, enum?: string[], minimum?: number, maximum?: number }[]>([]);

const saving = ref(false);
const errors = ref<string[]>([]);

const isEdit = computed(() => modalMode.value === 'edit');
const isView = computed(() => modalMode.value === 'view');

const isDirty = computed(() => {
  if (!initialValues.value) {
    return chartName.value !== '' ||
      chartShortDescription.value !== '' ||
      chartDescription.value !== '' ||
      helmChartUrl.value !== '' ||
      helmRepoUrl.value !== '' ||
      chartSettings.value.length > 0;
  }

  const initialSettings = Object.keys(initialValues.value.settings || {}).map((key) => ({
    name: key,
    type: initialValues.value.settings[key].type || 'string',
    enum: initialValues.value.settings[key].enum || [],
    minimum: initialValues.value.settings[key].minimum || 0,
    maximum: initialValues.value.settings[key].maximum || 0
  }));

  return chartName.value !== (initialValues.value.name || '') ||
    chartShortDescription.value !== (initialValues.value.short_description || '') ||
    chartDescription.value !== (initialValues.value.description || '') ||
    helmChartUrl.value !== (initialValues.value.helm_chart_url || '') ||
    helmRepoUrl.value !== (initialValues.value.helm_repo_url || '') ||
    !isEqual(sortBy(chartSettings.value, 'name'), sortBy(initialSettings, 'name'));
});

const showDiscardConfirm = ref(false);

const validationPassed = computed(() => {
  if (!chartName.value) return false;
  if (!chartShortDescription.value) return false;
  if (!chartDescription.value) return false;
  if (!helmChartUrl.value) return false;
  if (!helmRepoUrl.value) return false;

  for (const setting of chartSettings.value) {
    if (!setting.name) {
      return false;
    }

    if (setting.type === 'number' || setting.type === 'integer') {
      if (setting.minimum !== undefined && isNaN(setting.minimum)) {
        return false;
      }

      if (setting.maximum !== undefined && isNaN(setting.maximum)) {
        return false;
      }
    }
  }

  const nameErrors = validateKubernetesName(chartName.value, '', store.getters, undefined, []);
  return nameErrors.length === 0;
});

function openCreate() {
  errors.value = [];
  modalMode.value = 'create';
  chartName.value = '';
  chartShortDescription.value = '';
  chartDescription.value = '';
  helmChartUrl.value = '';
  helmRepoUrl.value = '';
  chartSettings.value = [];
  showModal.value = true;
}

function openView(row: EpinioAppChartModel) {
  errors.value = [];
  modalMode.value = 'view';
  chartName.value = row.name || row.meta?.name || '';
  chartShortDescription.value = row.short_description || '';
  chartDescription.value = row.description || '';
  helmChartUrl.value = row.helm_chart_url || '';
  helmRepoUrl.value = row.helm_repo_url || '';
  chartSettings.value = Object.keys(row.settings || {}).map((key) => ({
    name: key,
    type: row.settings[key].type || 'string',
    enum: row.settings[key].enum || [],
    minimum: row.settings[key].minimum || 0,
    maximum: row.settings[key].maximum || 0
  }));
}

function openEdit(row: EpinioAppChartModel) {
  errors.value = [];
  modalMode.value = 'edit';
  initialValues.value = row;
  chartName.value = row.name || row.meta?.name || '';
  chartShortDescription.value = row.short_description || '';
  chartDescription.value = row.description || '';
  helmChartUrl.value = row.helm_chart || '';
  helmRepoUrl.value = row.helm_repo || '';
  chartSettings.value = Object.keys(row.settings || {}).map((key) => ({
    name: key,
    type: row.settings[key].type || 'string',
    enum: row.settings[key].enum || [],
    minimum: row.settings[key].minimum || 0,
    maximum: row.settings[key].maximum || 0
  }));
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
  chartSettings.value = [];
  errors.value = [];
  showDiscardConfirm.value = false;
  showModal.value = false;
}

async function onSubmit() {
  if (!validationPassed.value || !isDirty.value || saving.value) return;

  saving.value = true;
  errors.value = [];

  const settings = chartSettings.value.reduce((acc, setting) => {
    acc[setting.name] = { type: setting.type };
    if (setting.type === 'string' && setting.enum) {
      acc[setting.name].enum = setting.enum.filter((v) => v);
    }
    if ((setting.type === 'number' || setting.type === 'integer') && setting.minimum !== undefined) {
      acc[setting.name].minimum = String(setting.minimum); // string not number
    }
    if ((setting.type === 'number' || setting.type === 'integer') && setting.maximum !== undefined) {
      acc[setting.name].maximum = String(setting.maximum); // string not number
    }
    return acc;
  }, {} as Record<string, any>);

  try {
    if (isEdit.value && initialValues.value) {
      const chart = initialValues.value;

      chart.description       = chartDescription.value;
      chart.short_description = chartShortDescription.value;
      chart.helm_chart        = helmChartUrl.value;
      chart.helm_repo         = helmRepoUrl.value;
      chart.settings          = settings;

      await chart.update();
      closeModal();
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP_CHARTS, opt: { force: true } }).catch(() => {});
    } else {
      const chart = await store.dispatch('epinio/create', { type: EPINIO_TYPES.APP_CHARTS });

      chart.metadata          = { name: chartName.value };
      chart.description       = chartDescription.value;
      chart.short_description = chartShortDescription.value;
      chart.helm_chart        = helmChartUrl.value;
      chart.helm_repo         = helmRepoUrl.value;
      chart.settings          = settings;

      await chart.create();
      closeModal();
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP_CHARTS, opt: { force: true } }).catch(() => {});
    }
  } catch (err: any) {
    errors.value = epinioExceptionToErrorsArray(err, t);
  } finally {
    saving.value = false;
  }
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
        <trailhand-form-row>
          <h3>Settings</h3>
        </trailhand-form-row>
        <template columns="3" v-for="(setting, index) in chartSettings" :key="index">
          <trailhand-form-row columns="3">
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
              @dropdown-change="(e: CustomEvent) => { 
                chartSettings[index].type = e.detail.value; 
                if (e.detail.value !== 'string') {
                  delete chartSettings[index].enum;
                }
                if (e.detail.value !== 'number' && e.detail.value !== 'integer') {
                  delete chartSettings[index].minimum;
                  delete chartSettings[index].maximum;
                }
              }"
            ></trailhand-dropdown>
            <div style="display: flex; align-items: flex-end; gap: 8px;">
              <trailhand-text-input
                v-if="setting.type === 'number' || setting.type === 'integer'"
                :value="setting.minimum"
                label="Minimum"
                :disabled="isEdit || isView"
                type="number"
                style="flex: 1"
                @text-input-change="(e: CustomEvent) => { chartSettings[index].minimum = e.detail.value; }"
              ></trailhand-text-input>
              <trailhand-text-input
                v-if="setting.type === 'number' || setting.type === 'integer'"
                :value="setting.maximum"
                label="Maximum"
                :disabled="isEdit || isView"
                type="number"
                style="flex: 1"
                @text-input-change="(e: CustomEvent) => { chartSettings[index].maximum = e.detail.value; }"
              ></trailhand-text-input>
              <trailhand-button
                variant="destructive"
                @button-click="chartSettings.splice(index, 1)"
                :disabled="isEdit || isView"
                style="margin-left: auto;"
              >
                Remove
              </trailhand-button>
            </div>
          </trailhand-form-row>
          <trailhand-form-row v-if="setting.type === 'string'">
            <div v-for="(value, enumIndex) in setting.enum || []" :key="enumIndex" style="display: flex; align-items: flex-end; gap: 8px;">
              <trailhand-text-input
                :value="value"
                label="Allowed Value"
                :disabled="isEdit || isView"
                @text-input-change="(e: CustomEvent) => { chartSettings[index].enum[enumIndex] = e.detail.value; }"
              ></trailhand-text-input>
              <trailhand-button
                variant="destructive"
                @button-click="chartSettings[index].enum.splice(enumIndex, 1)"
                :disabled="isEdit || isView"
                style="margin-top: 4px;"
              >
                Remove Value
              </trailhand-button>
            </div>
            <div>
              <trailhand-button
                variant="alternate"
                @button-click="chartSettings[index].enum = [...(setting.enum || []), '']"
                :disabled="isEdit || isView"
                style="margin-top: 4px;"
              >
                Add Value
              </trailhand-button>
            </div>
          </trailhand-form-row>
        </template>
        <div>
          <trailhand-button
            variant="alternate"
            @button-click="chartSettings.push({ name: '', type: 'string', enum: [] })"
            :disabled="isEdit || isView"
          >
            Add Setting
          </trailhand-button>
        </div>
      </trailhand-form-card>
      
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </div>

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
          :disabled="!validationPassed || !isDirty || saving"
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
