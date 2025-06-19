<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'vuex';

import SortableTable from '@shell/components/SortableTable/index.vue';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import BadgeState from '@components/BadgeState/BadgeState.vue';

import ApplicationAction, { APPLICATION_ACTION_TYPE } from '../../models/application-action';
import { STATE, DESCRIPTION } from '@shell/config/table-headers';
import {
  EPINIO_TYPES, 
  APPLICATION_ACTION_STATE,
  APPLICATION_SOURCE_TYPE,
  EpinioApplication,
  EpinioAppSource,
  EpinioAppBindings
} from '../../types';
import type EpinioNamespace from '../../models/namespaces';

const props = defineProps<{
  application: EpinioApplication,
  source: EpinioAppSource,
  bindings?: EpinioAppBindings | null,
  mode: string,
  step: any
}>();

const emit = defineEmits(['finished']);

const store = useStore();

const running = ref(false);
const actions = ref<ApplicationAction[]>([]);

const actionHeaders = [
  {
    name:     'epinio-name',
    labelKey: 'epinio.applications.steps.progress.table.stage.label',
    value:    'name',
    sort:     ['index'],
    width:    150,
  },
  {
    ...DESCRIPTION,
    sort:  undefined,
    value: 'description',
    width: 450,
  },
  {
    ...STATE,
    sort:     undefined,
    labelKey: 'epinio.applications.steps.progress.table.status',
    width:    150,
  },
];

const actionsToRun = computed(() => actions.value.filter(action => action.run));
const namespaces = computed(() => store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE));
const fetchApp = async () => {
  try {
    await props.application.forceFetch();
  } catch (err) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // silent catch
  }
};

const create = async () => {
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
      <SortableTable
        :rows="actions"
        :headers="actionHeaders"
        :table-actions="false"
        :row-actions="false"
        default-sort-by="epinio-name"
        :search="false"
        key-field="key"
      >
        <template #cell:index="{ row }">
          <Checkbox v-model="row.run" :disabled="true" />
        </template>

        <template #cell:state="{ row }">
          <div class="status">
            <i
              v-if="row.state === APPLICATION_ACTION_STATE.RUNNING"
              v-clean-tooltip="row.stateDisplay"
              class="icon icon-lg icon-spinner icon-spin"
            />
            <BadgeState
              v-else
              :color="row.stateBackground"
              :label="row.stateDisplay"
              class="badge"
            />
          </div>
        </template>
      </SortableTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.progress-container {
  display: flex;
  justify-content: center;

  .progress {
    padding: 10px 0;

    $statusHeight: 20px;

    .status {
      min-height: $statusHeight;
      display: flex;
      align-items: center;

      .badge {
        min-height: $statusHeight;
      }
    }
  }
}
</style>
