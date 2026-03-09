<script lang="ts" setup>
import { ref, computed, watch, onMounted, reactive } from 'vue';
import { useStore } from 'vuex';

import ApplicationAction, { APPLICATION_ACTION_TYPE } from '../../models/application-action';
import {
  EPINIO_TYPES,
  APPLICATION_SOURCE_TYPE,
  EpinioApplication,
  EpinioAppSource,
  EpinioAppBindings
} from '../../types';
import type EpinioNamespace from '../../models/namespaces';
import { makeProgressStateCell } from '../../utils/table-formatters';

const props = defineProps<{
  application: EpinioApplication,
  source: EpinioAppSource,
  bindings?: EpinioAppBindings | null,
  mode: string,
  step: any
}>();

const emit = defineEmits(['finished']);

const store = useStore();
const t = store.getters['i18n/t'];

const running = ref(false);
const actions = ref<ApplicationAction[]>([]);

const columns = [
  {
    field: 'name',
    label: t('epinio.applications.steps.progress.table.stage.label'),
    width: '150px',
    sortable: false,
  },
  {
    field: 'description',
    label: t('tableHeaders.description'),
    width: '450px',
    sortable: false,
    formatter: (_v: any, row: any) => {
      const wrapper = document.createElement('span');

      wrapper.style.cssText = 'display:flex; flex-direction:column;';

      const main = document.createElement('span');

      main.textContent = row.description || '';
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
    formatter: (_v: any, row: any) => makeProgressStateCell(row),
  },
];

const actionsToRun = computed(() => actions.value.filter(action => action.run));

// tableRows is a copy of actions that tracks state and stateMessage so any change to those properties triggers a Lit re-render
const tableRows = computed(() => {
  // Track state and stateMessage so any change triggers a Lit re-render
  actions.value.forEach((a: ApplicationAction) => { a.state; (a as any).stateMessage; });

  return [...actions.value];
});
const namespaces = computed(() => store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE));
const fetchApp = async () => {
  try {
    await props.application.forceFetch();
  } catch (err) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // silent catch
  }
};

const create = async () => {
  // Make each action reactive so changes to their state trigger updates in the UI
  actions.value = actions.value.map((a: ApplicationAction) => reactive(a) as ApplicationAction);
  running.value = true;
  const enabledActions = [...actionsToRun.value];

  for (const action of enabledActions) {
    try {
      await action.execute({ source: props.source });
    } catch (err) {
      running.value = false;
      console.error(err);
      await fetchApp();
      return;
    }
  }

  await fetchApp();
  running.value = false;
  emit('finished', true);
};

watch(running, (neu, prev) => {
  if (prev && !neu) {
    props.step.ready = true;
  }
});

const createActions = async () => {
  const REDEPLOY_SOURCE = store.$router.currentRoute._value.hash === '#source';

  const coreArgs = {
    application: props.application,
    bindings: props.bindings,
    type: EPINIO_TYPES.APP_ACTION,
  };

  const nsMatch = namespaces.value.find((ns: EpinioNamespace) => ns.name === props.application.meta.namespace);
  if (!nsMatch) {
    actions.value.push(await store.dispatch('epinio/create', {
      action: APPLICATION_ACTION_TYPE.CREATE_NS,
      index: 0,
      ...coreArgs
    }));
  }

  if (!REDEPLOY_SOURCE) {
    actions.value.push(await store.dispatch('epinio/create', {
      action: APPLICATION_ACTION_TYPE.CREATE,
      index: 1,
      ...coreArgs
    }));
  } else {
    actions.value.push(await store.dispatch('epinio/create', {
      action: APPLICATION_ACTION_TYPE.UPDATE_SOURCE,
      index: 2,
      ...coreArgs
    }));
  }

  if (props.bindings?.configurations?.length && !REDEPLOY_SOURCE) {
    actions.value.push(await store.dispatch('epinio/create', {
      action: APPLICATION_ACTION_TYPE.BIND_CONFIGURATIONS,
      index: 3,
      ...coreArgs
    }));
  }

  if (props.bindings?.services?.length && !REDEPLOY_SOURCE) {
    actions.value.push(await store.dispatch('epinio/create', {
      action: APPLICATION_ACTION_TYPE.BIND_SERVICES,
      index: 4,
      ...coreArgs
    }));
  }

  const srcType = props.source.type;

  if ([APPLICATION_SOURCE_TYPE.ARCHIVE, APPLICATION_SOURCE_TYPE.FOLDER].includes(srcType)) {
    actions.value.push(await store.dispatch('epinio/create', {
      action: APPLICATION_ACTION_TYPE.UPLOAD,
      index: 5,
      ...coreArgs
    }));
  }

  if ([APPLICATION_SOURCE_TYPE.GIT_URL, APPLICATION_SOURCE_TYPE.GIT_HUB, APPLICATION_SOURCE_TYPE.GIT_LAB].includes(srcType)) {
    actions.value.push(await store.dispatch('epinio/create', {
      action: APPLICATION_ACTION_TYPE.GIT_FETCH,
      index: srcType === APPLICATION_SOURCE_TYPE.GIT_URL ? 5 : 6,
      ...coreArgs
    }));
  }

  if ([APPLICATION_SOURCE_TYPE.ARCHIVE, APPLICATION_SOURCE_TYPE.FOLDER, APPLICATION_SOURCE_TYPE.GIT_URL,
       APPLICATION_SOURCE_TYPE.GIT_HUB, APPLICATION_SOURCE_TYPE.GIT_LAB].includes(srcType)) {
    actions.value.push(await store.dispatch('epinio/create', {
      action: APPLICATION_ACTION_TYPE.BUILD,
      index: 7,
      ...coreArgs
    }));
  }

  actions.value.push(await store.dispatch('epinio/create', {
    action: APPLICATION_ACTION_TYPE.DEPLOY,
    index: 8,
    ...coreArgs
  }));

  create();
};

onMounted(createActions);
</script>

<template>
  <div
    v-if="!$fetchState?.pending"
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
  </div>
</template>

<style lang="scss" scoped>
.progress-container {
  display: flex;
  justify-content: center;

  .progress {
    padding: 10px 0;

    trailhand-table {
      --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
      --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
      --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
    }
  }
}
</style>
