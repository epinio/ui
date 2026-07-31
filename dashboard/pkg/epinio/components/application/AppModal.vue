<script setup lang="ts">
import { computed, ref, reactive, watch, nextTick } from 'vue';
import { useStore } from 'vuex';

import { epinioExceptionToErrorsArray } from '../../utils/errors';
import Banner from '@components/Banner/Banner.vue';
import AppSource from './AppSource.vue';
import AppInfo from './AppInfo.vue';
import AppConfiguration from './AppConfiguration.vue';
import AppProgress from './AppProgress.vue';
import { EpinioAppInfo, EpinioAppBindings, EpinioAppSource, EPINIO_TYPES, APPLICATION_SOURCE_TYPE } from '../../types';
import { AppUtils } from '../../utils/application';
import Tabs from './Tabs.vue';
import { allHash } from '@shell/utils/promise';
import EpinioApplicationModel from 'models/applications';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Fires with the app's namespace once a create or edit has landed on the
// server. The applications list renders from per-namespace paginated fetches,
// not the global store, so it needs this signal to re-fetch the group -- a
// model-level forceFetch only updates the store slice nothing there reads.
const emit = defineEmits<{ saved: [namespace?: string] }>();

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit'>('create');
// Model instance, used only for API calls
const serviceModel = ref<any>(null);

// Form fields (separate from the model to avoid proxy mutation issues)
const loading = ref(true);
const value = ref<any>(null);
const source = ref<EpinioAppSource>();
const bindings = ref<EpinioAppBindings>();
const originalBindings = ref<EpinioAppBindings>();
const appChart = reactive({ chartsList: undefined as any, selectedChart: undefined });
const epinioInfo = ref<any>(null);
const originalModel = ref<any>(null);

const snapshot = ref<string | null>(null);

const saving = ref(false);
const errors = ref<string[]>([]);
const activeTab = ref<string | number>('source')
const tabs = ref([
  { id: 'source', label: 'Source', completed: false, valid: false, disabled: false },
  { id: 'details', label: 'Details', completed: false, valid: false, disabled: true },
  { id: 'bindings', label: 'Bindings', completed: false, valid: true, disabled: true },
])

const isEdit = computed(() => modalMode.value === 'edit');
const isView = computed(() => modalMode.value === 'view');

const nextTab = computed(() => {
  const idx = tabs.value.findIndex(t => t.id === activeTab.value)
  return tabs.value[idx + 1]?.id
})

const prevTab = computed(() => {
  const idx = tabs.value.findIndex(t => t.id === activeTab.value)
  return tabs.value[idx - 1]?.id
})

const isDirty = computed(() => {
  if (!snapshot.value || !value.value) return false
  return takeSnapshot() !== snapshot.value
});

const isSourceDirty = computed(() => {
  if (!snapshot.value) return false;

  return JSON.parse(snapshot.value).source !== AppUtils.sourceFingerprint(source.value);
});

// Folder and archive sources live in the browser only, so a redeploy needs the
// files selected again.
const needsUploadedSource = computed(() => [
  APPLICATION_SOURCE_TYPE.ARCHIVE,
  APPLICATION_SOURCE_TYPE.FOLDER,
].includes(source.value?.type as APPLICATION_SOURCE_TYPE));

const showDiscardConfirm = ref(false);

function takeSnapshot() {
  return JSON.stringify({
    source:        AppUtils.sourceFingerprint(source.value),
    bindings:      bindings.value,
    meta:          value.value?.meta,
    configuration: value.value?.configuration,
  });
}


async function openCreate() {
  errors.value = [];
  modalMode.value = 'create';
  loading.value = true;
  showModal.value = true;  // open modal first so user sees loading state

  tabs.value.push({ id: 'progress', label: 'Progress', completed: false, valid: true, disabled: true });

  const hash = await allHash({
    ns: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.NAMESPACE }),
    charts: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP_CHARTS }),
    images: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.BUILDER_IMAGE }),
    gitConfigs: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.GIT_CONFIG }),
    info: store.dispatch('epinio/info'),
  });

  epinioInfo.value = hash.info;
  appChart.chartsList = hash.charts;
  originalModel.value = await store.dispatch('epinio/create', { type: EPINIO_TYPES.APP });
  value.value = await store.dispatch('epinio/clone', { resource: originalModel.value });

  loading.value = false;

  await nextTick();
  snapshot.value = takeSnapshot();
}

async function openEdit(row: EpinioApplicationModel, commit?: string) {
  errors.value = [];
  modalMode.value = 'edit';
  loading.value = true;
  showModal.value = true;  // open modal first so user sees loading state

  const hash = await allHash({
    ns: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.NAMESPACE }),
    charts: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP_CHARTS }),
    images: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.BUILDER_IMAGE }),
    gitConfigs: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.GIT_CONFIG }),
    info: store.dispatch('epinio/info'),
  });

  epinioInfo.value = hash.info;
  appChart.chartsList = hash.charts;
  appChart.selectedChart = row.configuration?.appchart;
  originalModel.value = row;
  value.value = await store.dispatch('epinio/clone', { resource: originalModel.value });

  source.value = row.appSource;

  tabs.value.forEach(tab => {
    if (tab.id !== 'progress') tab.disabled = false;
    tab.valid = true;
  });

  if (!commit) loading.value = false;

  await nextTick();
  snapshot.value = takeSnapshot();

  // if opened from a specific commit, update source
  if (commit) {
    const newSource = {
      ...source.value,
      git: {
        ...source.value?.git,
        commit: commit,
      },
    };
    updateSource(newSource);
    loading.value = false;
  }
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
  // data
  value.value = null;
  originalModel.value = null;
  source.value = undefined;
  bindings.value = undefined;
  originalBindings.value = undefined;
  epinioInfo.value = null;
  appChart.chartsList = undefined;
  appChart.selectedChart = undefined;

  // ui state
  activeTab.value = 'source';
  tabs.value = tabs.value.filter(t => t.id !== 'progress') // remove progress tab added during create
  tabs.value.forEach((tab, i) => {
    tab.completed = false;
    tab.disabled = i !== 0;
  });
  errors.value = [];
  saving.value = false;
  loading.value = true;  // reset to true so next open shows spinner while fetching
  showDiscardConfirm.value = false;
  showModal.value = false;
  snapshot.value = null;

  // modal mode back to default
  modalMode.value = 'create';
  serviceModel.value = null;
}

// when namepace changes, remove bindings
watch(() => value.value?.meta.namespace, () => {
  bindings.value = { configurations: [], services: [] };
  set(value.value.configuration, { configurations: [] });
});

watch(() => isSourceDirty.value, () => {
  if (modalMode.value !== 'edit') {
    return;
  }
  if (isSourceDirty.value) {
    // add the progress tab if it doesn't exist (in case user goes back to source tab after completing it)
    if (!tabs.value.find(t => t.id === 'progress')) {
      tabs.value.push({ id: 'progress', label: 'Progress', completed: false, valid: true, disabled: true });
    }
  } else {
    // remove the progress tab if source is back to original
    tabs.value = tabs.value.filter(t => t.id !== 'progress');
  }
});

function set(obj: Record<string, any>, changes: Record<string, any>) {
  Object.entries(changes).forEach(([key, val]) => {
    obj[key] = val;
  });
}

function updateInfo(changes: EpinioAppInfo) {
  value.value.meta ||= {};
  value.value.configuration ||= {};
  set(value.value.meta, changes.meta);
  set(value.value.configuration, { settings: appChart.settings });
  set(value.value.configuration, changes.configuration);
}

function updateSource(changes: EpinioAppSource) {
  source.value = {};
  const { appChart: chartId, ...cleanChanges } = changes;

  const prevChartId = appChart.selectedChart;
  appChart.selectedChart = chartId;
  value.value.configuration ||= {};

  if (chartId) {
    set(value.value.configuration, { appchart: chartId });
  }

  const chartChanged = chartId !== prevChartId;
  if (!isEdit.value || chartChanged) {
    value.value.configuration.settings = undefined;

    if (chartId) {
      const chart = appChart.chartsList?.find((c: any) => c.id === chartId);

    if (chart?.settings) {
      const customSettings = Object.keys(chart.settings).reduce((acc, key) => {
        const fallbackValue = chart?.settings[key].type === 'bool' ? false : '';
        acc[key] = chart?.values?.[key] || fallbackValue;
        return acc;
      }, {} as Record<string, any>);

        set(value.value.configuration, { settings: customSettings });
        set(value.value, { chart });
      }
    }
  }

  set(source.value, cleanChanges);
}

function updateManifestConfigurations(configs: string[]) {
  set(value.value.configuration, { configurations: configs });
}

function updateConfigurations(changes: EpinioAppBindings) {
  bindings.value = {};
  set(bindings.value, changes);
  set(value.value.configuration, { configurations: changes.configurations });
}

// What the bindings form found bound on open. The store's configuration and
// service slices only hold one page of their lists, so they cannot be used as
// the baseline for the save diff.
function captureOriginalBindings(partial: Partial<EpinioAppBindings>) {
  originalBindings.value = { ...originalBindings.value, ...partial } as EpinioAppBindings;
}

async function onSubmit() {
  if (saving.value) return;
  saving.value = true;
  errors.value = [];

  try {
    if (isEdit.value) {
      // Nothing is saved yet, so bail before a half-applied edit.
      if (isSourceDirty.value && needsUploadedSource.value && !source.value?.archive?.tarball) {
        errors.value = [t('epinio.applications.action.upload.missingSource')];
        saving.value = false;

        return;
      }

      // Always save metadata/config changes
      await value.value.update({ restart: !!value.value.canRestartAfterConfigSave });
      await value.value.updateConfigurations(
        originalBindings.value?.configurations || [],
        bindings.value?.configurations || [],
      );
      await value.value.updateServices(
        originalBindings.value?.services || [],
        bindings.value?.services || [],
      );

      if (isSourceDirty.value) {
        // Source changed — need full redeploy pipeline
        saving.value = false;
        completeTab('bindings', 'progress'); // progress tab handles the rest
      } else {
        await value.value.forceFetch();
        emit('saved', value.value?.meta?.namespace);
        closeModal();
      }
    } else {
      completeTab('bindings', 'progress');
    }
  } catch (err: any) {
    errors.value = epinioExceptionToErrorsArray(err);
  } finally {
    if (!isEdit.value) saving.value = false;
  }
}

// Creates and source redeploys run through the progress tab's pipeline, so the
// modal only learns the app landed when AppProgress says it finished.
function handleProgressFinished() {
  emit('saved', value.value?.meta?.namespace);
}

// A failed pipeline strands the user on the progress tab. Let them back into the
// form to fix the source and retry.
function handleProgressFailed() {
  tabs.value.forEach((tab) => {
    if (tab.id !== 'progress') {
      tab.disabled = false;
    }
  });
}

function completeTab(tabId: string | number, nextTabId: string | number) {
  const tab = tabs.value.find((t) => t.id === tabId)
  const next = tabs.value.find((t) => t.id === nextTabId)
  if (tab && !isEdit.value)  tab.completed = true
  if (next) next.disabled = false
  // if moving to the last tab, disable all previous tabs to prevent jumping back and forth during deploy progress
  if (nextTabId === 'progress') {
    tabs.value.forEach(t => {
      if (t.id !== 'progress') t.disabled = true
    })
  }
  activeTab.value = nextTabId
}

defineExpose({ openCreate, openEdit });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible="false"
    :title="(isEdit || isView) ? value?.meta?.name : 'Application'"
    :subtitle="(isEdit || isView) ? (value?.stateDisplay || '') : 'Create New'"
    position="top"
    @modal-close="handleModalClose"
  >
    <div id="modal-container-element" class="modal-content">
      <Loading v-if="loading" />
      <Tabs v-else v-model="activeTab" :tabs="tabs">
        <template #source>
          <AppSource
            :application="value"
            :source="source"
            :mode="modalMode"
            :info="epinioInfo"
            @change="updateSource"
            @change-app-info="updateInfo"
            @change-app-config="updateManifestConfigurations"
            @valid="(val) => {
              if (!isEdit)tabs[0].completed = val;
              tabs[0].valid = val;
              tabs[1].disabled = !val;
            }"
          />
        </template>

        <template #details="{ tab }">
          <AppInfo
            :application="value"
            :source="source"
            :mode="modalMode"
            :active="activeTab === tab.id"
            @change="updateInfo"
            @valid="(val) => {
              if (!isEdit) tabs[1].completed = val;
              tabs[1].valid = val;
              tabs[2].disabled = !val;
              // also disable final tab since the third tab has no required fields
              if (tabs[3] && !isEdit) tabs[3].disabled = !val;
            }"
          />
        </template>

        <template #bindings>
          <AppConfiguration
            :application="value"
            :initial-application="originalModel"
            :mode="modalMode"
            :bindings="bindings"
            :active="activeTab === 'bindings'"
            @change="updateConfigurations"
            @initial="captureOriginalBindings"
          />
        </template>

        <template #progress="{ tab }">
          <AppProgress
            :application="value"
            :source="source"
            :bindings="bindings"
            :mode="modalMode"
            :tab="tab"
            :active="activeTab === tab.id"
            @finished="handleProgressFinished"
            @failed="handleProgressFailed"
          />
      </template>
      </Tabs>
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
          v-if="activeTab !== 'progress'"
          variant="secondary"
          class="mr-10"
          @button-click="handleModalClose"
        >
          Cancel
        </trailhand-button>
        <trailhand-button
          v-if="!!prevTab && activeTab !== 'progress'"
          variant="secondary"
          class="mr-10"
          @button-click="activeTab = prevTab"
        >
          Previous
        </trailhand-button>
        <trailhand-button
          v-if="nextTab && activeTab !== 'progress'"
          :variant="!isEdit ? 'primary' : 'secondary'"
          class="mr-10"
          :disabled="tabs.find(t => t.id === nextTab)?.disabled"
          @button-click="completeTab(activeTab, nextTab)"
        >
          Next
        </trailhand-button>
        <trailhand-button
          v-if="isEdit && activeTab !== 'progress'"
          variant="primary"
          :disabled="!isDirty || saving || tabs.some(t => !t.valid)"
          @button-click="onSubmit"
        >
          {{ saving ? 'Saving...' : t('generic.save') }}
        </trailhand-button>
        <trailhand-button
          v-if="activeTab === 'progress'"
          variant="primary"
          :disabled="false"
          @button-click="closeModal"
        >
          Finish
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
