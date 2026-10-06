<script lang="ts" setup>
import { computed, watch } from 'vue';
import { useStore } from 'vuex';
import { makeProgressStateCell } from '../../utils/table-formatters';
import { useAppPipeline, PipelineStep } from '../../models/application/actions/useAppPipeline';
import { App, AppForm } from '../../models/application/ui-types';
import { FormState } from '../../models/application/form/useAppForm';

const props = defineProps<{
  form: AppForm,
  initialForm: AppForm,
  initialApp: App | null,
  formState: FormState,
  mode: 'create' | 'edit',
  active: boolean,
  onPipelineStart: () => void,
  onPipelineSuccess: () => void,
  onPipelineFailure: () => void,
  setModalToEdit: () => void,
}>();

const emit = defineEmits(['finished', 'failed']);

const store = useStore();
const t = store.getters['i18n/t'];

const { steps, running, failed, isDone, hasAppBeenCreated, run } = useAppPipeline(store);

const columns = [
  {
    field: 'label',
    label: t('epinio.applications.steps.progress.table.stage.label'),
    width: '150px',
    sortable: false,
    formatter: (_v: any, row: PipelineStep) => t(`epinio.applications.action.${ row.action }.label`) || '',
  },
  {
    field: 'description',
    label: t('tableHeaders.description'),
    width: '450px',
    sortable: false,
    formatter: (_v: any, row: PipelineStep) => {
      const wrapper = document.createElement('span');

      wrapper.style.cssText = 'display:flex; flex-direction:column;';

      const main = document.createElement('span');

      main.textContent = t(`epinio.applications.action.${ row.action }.description`) || '';
      wrapper.appendChild(main);

      // stateMessage is set on failure — show it as secondary error text
      if (row.stateMessage) {
        const sub = document.createElement('span');

        sub.style.cssText = 'font-size:0.85em; color:var(--error); margin-top:2px;';
        sub.textContent = row.stateMessage;
        wrapper.appendChild(sub);
      }

      return wrapper;
    },
  },
  {
    field: 'stateDisplay',
    label: t('epinio.applications.steps.progress.table.status'),
    width: '150px',
    sortable: false,
    formatter: (_v: any, row: PipelineStep) => makeProgressStateCell(row),
  },
];


// tableRows is a copy of actions that tracks state and stateMessage so any change to those properties triggers a Lit re-render
const tableRows = computed(() => {
  // Track state and stateMessage so any change triggers a Lit re-render
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  steps.value.forEach((s) => { s.state; s.stateMessage; }); // touch props to trigger Lit re-render
  return [...steps.value];
});

// Run the pipeline when the tab becomes active
watch(() => props.active, async (isActive) => {
  if (!isActive || running.value) {
    return;
  }

  props.onPipelineStart();

  await run({
    mode: props.mode,
    form: props.form,
    initialForm: props.initialForm,
    initialApp: props.initialApp,
    state: props.formState,
  })
});

// When the pipeline completes successfully, call the onPipelineSuccess callback
watch(isDone, (isDone) => {
  if (isDone && !failed.value) {
    props.onPipelineSuccess();
  }
});

// When the pipeline fails, call the onPipelineFailure callback
watch(failed, (hasFailed) => {
  if (hasFailed) {
    props.onPipelineFailure();
    if (hasAppBeenCreated.value) {
      props.setModalToEdit();
    }
  }
});
</script>

<template>
  <div
    class="progress-container"
  >
    <div class="progress">
      <trailhand-table
        :rows="tableRows"
        :columns="columns"
        :searchable="false"
        key-field="key"
      />
    </div>
    <h3>The application will continue {{ props.mode === 'edit' ? 'updating' : 'deploying' }} in the background. Feel free to close this modal.</h3>
  </div>
</template>

<style lang="scss" scoped>
.progress-container {
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  .progress {
    padding: 10px 0;
    display: flex;
    
    trailhand-table {
      --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
      --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
      --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
    }
  }
}
</style>
