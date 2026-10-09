<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import AppSource from './AppSource.vue';
import AppBuildOptions from './AppBuildOptions.vue';
import AppInfo from './AppInfo.vue';
import AppConfiguration from './AppConfiguration.vue';
import AppProgress from './AppProgress.vue';
import Tabs from './Tabs.vue';
import { App } from '../../models/application/ui-types';
import { useAppForm } from '../../models/application/form/useAppForm';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit'>('create');

const initialApp = ref<App | null>(null);

const { form, initialForm, populateFormFromApp, clearForm, state, update } = useAppForm(modalMode);

const activeTab = ref<string | number>('source')
const isPipelineActive = ref<boolean>(false);
const tabs = computed(() => [
  { id: 'source', 
    label: 'Source', 
    completed: (state.source.dirty.value || isEdit.value) && state.source.valid.value, 
    valid: state.source.valid.value, 
    disabled: isPipelineActive.value, 
    visible: true 
  },
  { id: 'build', 
    label: 'Build Options', 
    completed: (state.buildOptions.dirty.value || isEdit.value) && state.buildOptions.valid.value, 
    valid: state.buildOptions.valid.value, 
    disabled: isEdit.value ? isPipelineActive.value : !state.source.valid.value || isPipelineActive.value, 
    visible: true 
  },
  { id: 'details', 
    label: 'Details', 
    completed: (state.details.dirty.value || isEdit.value) && state.details.valid.value, 
    valid: state.details.valid.value, 
    disabled: isEdit.value ? isPipelineActive.value : !state.buildOptions.valid.value || isPipelineActive.value, 
    visible: true 
  },
  { id: 'bindings', 
    label: 'Bindings', 
    completed: (state.bindings.dirty.value || isEdit.value) && state.bindings.valid.value, 
    valid: state.bindings.valid.value, 
    disabled: isEdit.value ? isPipelineActive.value : !state.details.valid.value || isPipelineActive.value, 
    visible: true 
  },
  { id: 'progress', 
    label: 'Progress', 
    completed: false, 
    valid: true, 
    disabled: !state.dirty.value || !state.valid.value, 
    visible: true 
  }
])

const isEdit = computed(() => modalMode.value === 'edit');

const nextTab = computed(() => {
  const idx = tabs.value.findIndex(t => t.id === activeTab.value)
  return tabs.value[idx + 1]?.id
})

const prevTab = computed(() => {
  const idx = tabs.value.findIndex(t => t.id === activeTab.value)
  return tabs.value[idx - 1]?.id
})

const isDirty = computed(() => {
  return state.dirty.value;
});

const showDiscardConfirm = ref(false);

async function openCreate() {
  modalMode.value = 'create';
  showModal.value = true;
}

async function openEdit(row: App, commit?: string) {
  modalMode.value = 'edit';
  showModal.value = true;
  initialApp.value = row;
  const form = populateFormFromApp(row, true);

  if (commit) {
    update.source(form.source.type, { commit });
  }
}

function handleModalClose() {
  if (state.dirty.value) {
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
  clearForm();
  showDiscardConfirm.value = false;
  activeTab.value = 'source';
  showModal.value = false;
  modalMode.value = 'create';
  initialApp.value = null;
}

async function onSubmit() {
  if (isPipelineActive.value) {
    return;
  }

  completeTab('bindings', 'progress');
}

function completeTab(tabId: string | number, nextTabId: string | number) {
  activeTab.value = nextTabId
}

function onPipelineStart() {
  isPipelineActive.value = true;
}

function onPipelineSuccess() {
  isPipelineActive.value = false;
  closeModal();
}

function onPipelineFailure() {
  isPipelineActive.value = false;
}

function setModalToEdit() {
  modalMode.value = 'edit';
}

defineExpose({ openCreate, openEdit });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible="false"
    :title="(isEdit) ? (initialApp?.meta.name || 'Application') : 'Application'"
    :subtitle="(isEdit) ? (initialApp?.stateDisplay || 'Update') : 'Create New'"
    position="top"
    @modal-close="closeModal"
  >
    <div id="modal-container-element" class="modal-content">
      <Tabs v-model="activeTab" :tabs="tabs">
        <template #source>
          <AppSource
            :source="form.source"
            :mode="modalMode"
            :updateSource="update.source"
            :populateFormFromApp="populateFormFromApp"
          />
        </template>

        <template #build="{ tab }">
          <AppBuildOptions
            :buildOptions="form.buildOptions"
            :sourceType="form.source?.type"
            :modalOpen="showModal"
            :mode="modalMode"
            :active="activeTab === tab.id"
            :updateBuildOptions="update.buildOptions"
          />
        </template>

        <template #details="{ tab }">
          <AppInfo
            :details="form.details"
            :mode="modalMode"
            :source="form.source"
            :chart="form.buildOptions.appChart"
            :active="activeTab === tab.id"
            :updateDetails="update.details"
            :updateChartSettings="update.chartSettings"
            :updateBindings="update.bindings"
          />
        </template>

        <template #bindings>
          <AppConfiguration
            :bindings="form.bindings"
            :namespace="form.details.namespace"
            :mode="modalMode"
            :active="activeTab === 'bindings'"
            :updateBindings="update.bindings"
          />
        </template>

        <template #progress="{ tab }">
          <AppProgress
            :form="form"
            :initialForm="initialForm"
            :initialApp="initialApp"
            :formState="state"
            :mode="modalMode"
            :active="activeTab === tab.id"
            :onPipelineStart="onPipelineStart"
            :onPipelineSuccess="onPipelineSuccess"
            :onPipelineFailure="onPipelineFailure"
            :setModalToEdit="setModalToEdit"
          />
      </template>
      </Tabs>
    </div>

    <div slot="footer">
      <template v-if="showDiscardConfirm">
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
          :disabled="!isDirty || tabs.some(t => !t.valid)"
          @button-click="onSubmit"
        >
          {{ t('generic.save') }}
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
      <!-- <trailhand-button
        variant="secondary"
        class="mr-10"
        @button-click="() => { console.log('Form data:', form); console.log('Form state:', state); }"
      >
        Log Form
      </trailhand-button> -->
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
