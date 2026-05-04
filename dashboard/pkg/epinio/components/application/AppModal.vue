<script setup lang="ts">
import { computed, ref, reactive, watch, nextTick } from 'vue';
import { useStore } from 'vuex';

import { epinioExceptionToErrorsArray } from '../../utils/errors';
import Banner from '@components/Banner/Banner.vue';
import AppSource from './AppSource.vue';
import AppInfo from './AppInfo.vue';
import AppConfiguration from './AppConfiguration.vue';
import AppProgress from './AppProgress.vue';
import { EpinioAppInfo, EpinioAppBindings, EpinioAppSource, EPINIO_TYPES } from '../../types';
import { _CREATE } from '@shell/config/query-params';
import Tabs from './Tabs.vue';
import { allHash } from '@shell/utils/promise';
import EpinioApplicationModel from 'models/applications';

const store = useStore() as any;
const t = store.getters['i18n/t'];

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
const appChart = reactive({ chartsList: undefined as any, selectedChart: undefined });
const epinioInfo = ref<any>(null);
const originalModel = ref<any>(null);

const snapshot = ref<string | null>(null);

const saving = ref(false);
const errors = ref<string[]>([]);
const activeTab = ref<string | number>('source')
const tabs = ref([
  { id: 'source', label: 'Source', completed: false, valid: modalMode.value === 'edit', disabled: false },
  { id: 'details', label: 'Details', completed: false, valid: modalMode.value === 'edit', disabled: true },
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
  
  const snapshotSource = JSON.parse(snapshot.value).source;
  const currentSource = JSON.parse(takeSnapshot()).source;
  
  return JSON.stringify(snapshotSource) !== JSON.stringify(currentSource);
});

const showDiscardConfirm = ref(false);

function takeSnapshot() {
  return JSON.stringify({
    source: {
      ...source.value,
      git: {
        ...source.value?.git,
        sourceData: undefined, // ignore dynamic data
      },
    },
    bindings: bindings.value,
    meta: value.value?.meta,
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

async function openEdit(row: EpinioApplicationModel) {
  errors.value = [];
  modalMode.value = 'edit';
  loading.value = true;
  showModal.value = true;  // open modal first so user sees loading state

  const hash = await allHash({
    ns: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.NAMESPACE }),
    charts: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP_CHARTS }),
    info: store.dispatch('epinio/info'),
  });

  epinioInfo.value = hash.info;
  appChart.chartsList = hash.charts;
  originalModel.value = row;
  value.value = await store.dispatch('epinio/clone', { resource: originalModel.value });

  source.value = row.appSource;

  tabs.value.forEach(tab => tab.id !== 'progress' ? tab.disabled = false : null);

  loading.value = false;

  await nextTick();
  snapshot.value = takeSnapshot();
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

  appChart.selectedChart = chartId;
  value.value.configuration ||= {};
  value.value.configuration.settings = undefined;

  if (chartId) {
    set(value.value.configuration, { appchart: chartId });
    const chart = appChart.chartsList?.find((c: any) => c.id === chartId);

    if (chart?.settings) {
      const customSettings = Object.keys(chart.settings).reduce((acc, key) => {
        acc[key] = '';
        return acc;
      }, {} as Record<string, any>);

      set(value.value.configuration, { settings: customSettings });
      set(value.value, { chart });
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

async function onSubmit() {
  if (saving.value) return;
  saving.value = true;
  errors.value = [];

  try {
    if (isEdit.value) {
      // Always save metadata/config changes
      await value.value.update();
      await value.value.updateConfigurations(
        originalModel.value.baseConfigurationsNames || [],
        bindings.value?.configurations || [],
      );
      await value.value.updateServices(
        originalModel.value.services || [],
        bindings.value?.services || [],
      );

      if (isSourceDirty.value) {
        // Source changed — need full redeploy pipeline
        saving.value = false;
        completeTab('bindings', 'progress'); // progress tab handles the rest
      } else {
        await value.value.forceFetch();
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
    @modal-close="handleModalClose"
    position="top"
  >
    <div class="modal-content" id="modal-container-element">
      <Loading v-if="loading" />
      <Tabs v-else :tabs="tabs" v-model="activeTab">
        <template #source="{ tab }">
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

        <template #bindings="{ tab }">
          <AppConfiguration
            :application="value"
            :initial-application="originalModel"
            :mode="modalMode"
            :bindings="bindings"
            @change="updateConfigurations"
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
        <trailhand-button v-if="nextTab"
          variant="secondary"
          class="mr-10"
          @button-click="handleModalClose"
        >
          Cancel
        </trailhand-button>
        <trailhand-button
          v-if="!!prevTab && nextTab"
          variant="secondary"
          class="mr-10"
          @button-click="activeTab = prevTab"
        >
          Previous
        </trailhand-button>
        <trailhand-button v-if="!nextTab && !isEdit"
          variant="primary"
          :disabled="false"
          @button-click="closeModal"
        >
          Finish
        </trailhand-button>
        <trailhand-button v-else-if="nextTab"
          :variant="!isEdit ? 'primary' : 'secondary'"
          class="mr-10"
          :disabled="tabs.find(t => t.id === nextTab)?.disabled"
          @button-click="completeTab(activeTab, nextTab)"
        >
          Next
        </trailhand-button>
        <trailhand-button v-if="isEdit && nextTab"
          variant="primary"
          :disabled="!isDirty || saving || tabs.some(t => !t.valid)"
          @button-click="onSubmit"
        >
          {{ saving ? 'Saving...' : t('generic.save') }}
        </trailhand-button>
        <trailhand-button v-else-if="!nextTab && isEdit"
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
