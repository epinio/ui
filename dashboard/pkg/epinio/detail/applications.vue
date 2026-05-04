<script setup lang="ts">
import { ref, computed, onMounted, watchEffect } from 'vue';
import { useStore } from 'vuex';
import day from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import Application from '../models/applications';
import { GitUtils } from '@shell/utils/git';
import { isArray } from '@shell/utils/array';
import { EPINIO_TYPES } from '../types';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import Tabs from '../components/application/Tabs.vue';
import Banner from '@components/Banner/Banner.vue';
import { makeStateTag, makeActionMenu, makeCommitShaCell, makeCommitAuthorCell, overrideTableRows } from '../utils/table-formatters';
import ServiceInstanceModal from '../components/service/ServiceInstanceModal.vue';
import ServiceDeleteModal from '../components/service/ServiceDeleteModal.vue';
import EpinioServiceModel from 'models/services';
import ConfigurationModal from '../components/configuration/ConfigurationModal.vue';
import ConfigurationDeleteModal from '../components/configuration/ConfigurationDeleteModal.vue';
import AppModal from '../components/application/AppModal.vue';

day.extend(relativeTime);

const props = defineProps<{
  value: Application;
  initialValue: Application;
  mode: string;
}>();

const store = useStore();

const t = store.getters['i18n/t'];

const scalingInFlight = ref(false);
const debouncePending = ref(false);
const gitSource = ref<any>(null);
const gitDeployment = ref({
  deployedCommit: { short: '', long: '' },
  commits: null as any
});
const activeDeploymentTab = ref<string | number>('overview');
const deploymentTabs = ref([
  { id: 'overview', label: t('epinio.applications.detail.tables.overview'), completed: false, valid: true, disabled: false },
])
const activeResourceTab = ref<string | number>('instances');
const resourceTabs = ref([
  { id: 'instances', label: t('epinio.applications.detail.tables.instances'), completed: false, valid: true, disabled: false },
  { id: 'services', label: t('epinio.applications.detail.tables.services'), completed: false, valid: true, disabled: false },
  { id: 'configs', label: t('epinio.applications.detail.tables.configs'), completed: false, valid: true, disabled: false }
]);

const serviceModal = ref<InstanceType<typeof ServiceInstanceModal> | null>(null);
const serviceDeleteModal = ref<InstanceType<typeof ServiceDeleteModal> | null>(null);
const serviceRows = ref<any[]>([]);

const configModal = ref<InstanceType<typeof ConfigurationModal> | null>(null);
const configDeleteModal = ref<InstanceType<typeof ConfigurationDeleteModal> | null>(null);
const configRows = ref<any[]>([]);

const appModal = ref<InstanceType<typeof AppModal> | null>(null);

const instanceColumns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px',
    formatter: (_v: any, row: any) => makeStateTag(row)
  },
  {
    field: 'name',
    label: 'Name',
    formatter: (_v: any, row: any) => {
      const nameText = document.createElement('p');
      nameText.textContent = row.nameDisplay || row.meta?.name || '';
      nameText.style.whiteSpace = 'normal';
      nameText.style.wordBreak = 'break-word';
      return nameText;
    }
  },
  {
    field: 'millicpus',
    label: 'Mill CPUs',
    formatter: 'milliCPUs'
  },
  {
    field: 'memoryBytes',
    label: 'RAM',
    formatter: 'memory'
  },
  {
    field: 'restarts',
    label: 'Restarts'
  },
  {
    field: 'createdAt',
    label: 'Age',
    formatter: 'age'
  }
];

const serviceColumns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px',
    formatter: (_v: any, row: any) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name'
  },
  {
    field: 'catalog_service',
    label: 'Catalog Service'
  },
  {
    field: 'catalog_service_version',
    label: 'Catalog Service Version'
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];

const configColumns = [
  {
    field: 'nameDisplay',
    label: 'Name'
  },
  {
    field: 'variableCount',
    label: 'No. of Variables'
  },
  {
    field: 'configuration.user',
    label: 'Created By'
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];

watchEffect(() => {
  const all = [...props.value.services];

  all.forEach((row: any) => { void row.status; void row.stateDisplay; void row.meta; });

  // Filter empty rows that are added during delete
  const filtered = all.filter((row) => {
    if (!row.id) return false;
    else return true;
  });

  // Add custom service delete action to replace the built in rancher shell flow
  const overrideProps = [
    {
      prop: 'availableActions',
      value: (row: EpinioServiceModel) => (
        [
          {
            action: 'removeService',
            altAction: 'remove',
            bulkAction: 'removeService',
            bulkable: true, 
            enabled: row.canDelete,
            icon: 'icon icon-trash',
            label: 'Delete',
            weight: -10
          }, 
          {
            action: 'editServiceModal',
            label: 'Edit',
            enabled: true
          }
        ]
      ),
      conditionFn: (row: EpinioServiceModel) => {
        return true;
      },
    },
    {
      prop: 'removeService',
      value: (row: EpinioServiceModel) => () => {
        serviceDeleteModal.value?.openDelete(row);
      },
      conditionFn: (row: EpinioServiceModel) => {
        return row.canDelete;
      }, 
    },
    {
      prop: 'editServiceModal',
      value: (row: EpinioServiceModel) => () => {
        serviceModal.value?.openEdit(row);
      },
      conditionFn: (row: EpinioServiceModel) => {
        return true;
      }, 
    }
  ];

  serviceRows.value = [...overrideTableRows(filtered, overrideProps)];
});

watchEffect(() => {
  const all = [...props.value.baseConfigurations];

  all.forEach((row: any) => { void row.status; void row.stateDisplay; void row.meta; });

  const overrides = [
    {
      prop: 'availableActions',
      value: (row: any) => [
        {
          action:     'editConfigModal',
          label:      'Edit',
          enabled:    row.configuration?.type === 'custom',
          icon:       'icon icon-edit',
        },
        {
          action:  'deleteConfigModal',
          label:   'Delete',
          enabled: row.configuration?.type === 'custom',
          icon:    'icon icon-trash',
          weight:  -10,
        },
      ],
      conditionFn: () => true,
    },
    {
      prop:        'editConfigModal',
      value:       (row: any) => () => { configModal.value?.openEdit(row); },
      conditionFn: (row: any) => row.configuration?.type === 'custom',
    },
    {
      prop:        'deleteConfigModal',
      value:       (row: any) => () => { configDeleteModal.value?.openDelete(row); },
      conditionFn: (row: any) => row.configuration?.type === 'custom',
    },
  ];

  configRows.value = [...overrideTableRows(all, overrides)];
});

const commitActions = [{
  action: 'editFromCommit',
  label: t('epinio.applications.actions.editFromCommit.label'),
  icon: 'icon icon-edit',
  enabled: true
}];

// Debounce settings for scaling instances
const UPDATE_INSTANCES_DEBOUNCE_MS = 2000; // 2s; adjust as needed
let updateInstancesTimeout: number | null = null;

onMounted(async () => {
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION });

  if (props.value.appSource.git) {
    await fetchRepoDetails();
    setCommitDetails();
    deploymentTabs.value.push(
      { id: 'gitCommits', label: t('epinio.applications.detail.tables.gitCommits'), completed: false, valid: true, disabled: false }
    );
  }
});

async function updateInstances(newInstances: number) {
  // Update desired and configured instances immediately so the UI reflects the target
  props.value.desiredInstances = newInstances;
  props.value.configuration.instances = newInstances;

  // Debounce the API call so rapid clicks collapse into one request
  if (updateInstancesTimeout !== null) {
    clearTimeout(updateInstancesTimeout);
  }
  debouncePending.value = true;

  updateInstancesTimeout = window.setTimeout(async () => {
    debouncePending.value = false;
    scalingInFlight.value = true;

    try {
      await props.value.update();
      await props.value.forceFetch();
    } catch (err) {
      console.error('[Epinio instances] Failed to scale Application', epinioExceptionToErrorsArray(err));
    } finally {
      scalingInFlight.value = false;
      debouncePending.value = false;
      updateInstancesTimeout = null;
    }
  }, UPDATE_INSTANCES_DEBOUNCE_MS);
}

const showScaleSpinner = computed(() => debouncePending.value || scalingInFlight.value);

function formatURL(str: string) {
  const matchGit = str.match('^(https|git)(:\/\/|@)([^\/:]+)[\/:]([^\/:]+)\/(.+)(.git)*$'); // eslint-disable-line no-useless-escape
  return `${matchGit?.[4]}/${matchGit?.[5]}`;
}

async function fetchRepoDetails() {
  const { usernameOrOrg, repo } = props.value.appSource.git;
  const res = await store.dispatch(`${gitType.value}/fetchRepoDetails`, { username: usernameOrOrg, repo });

  gitSource.value = GitUtils[gitType.value].normalize.repo(res);
  await fetchCommits();
}

async function fetchCommits() {
  const { usernameOrOrg, repo, branch } = props.value.appSource.git;

  if (branch?.name) {
    gitDeployment.value.commits = await store.dispatch(`${gitType.value}/fetchCommits`, {
      username: usernameOrOrg, repo, branch
    });
  }
}

function setCommitDetails() {
  const { commit } = props.value.appSource.git;
  const selectedCommit = preparedCommits.value.find((c) => c.commitId === commit);

  gitDeployment.value.deployedCommit = {
    short: selectedCommit?.commitId?.slice(0, 7),
    long: selectedCommit.commitId
  };
}

const gitType = computed(() => props.value.appSource?.type || null);

const preparedCommits = computed(() => {
  const commits = gitDeployment.value.commits;

  if (!commits) {
    return [];
  }

  const arr = isArray(commits) ? commits : [commits];

  return arr.map((c: { sha: any; id: any; }) => ({
    ...GitUtils[gitType.value].normalize.commit(c),
    availableActions: commitActions,
    editFromCommit: () => appModal.value?.openEdit(props.value, c.sha)
  }));
});

const gitCommitsColumns = computed(() => [
  {
    field: 'sha',
    label: t(`gitPicker.${gitType.value}.tableHeaders.sha.label`),
    width: '100px',
    formatter: (_v: any, row: any) => makeCommitShaCell(
      row,
      gitDeployment.value.deployedCommit.long,
      t('epinio.applications.detail.deployment.details.git.deployed')
    )
  },
  {
    field: 'author_login',
    label: t(`gitPicker.${gitType.value}.tableHeaders.author.label`),
    width: '190px',
    formatter: (_v: any, row: any) => makeCommitAuthorCell(
      row,
      t(`gitPicker.${gitType.value}.tableHeaders.author.unknown`)
    )
  },
  {
    field: 'message',
    label: t(`gitPicker.${gitType.value}.tableHeaders.message.label`)
  },
  {
    field: 'date',
    label: t(`gitPicker.${gitType.value}.tableHeaders.date.label`),
    width: '220px',
    formatter: 'dateTime'
  }
]);

const sourceIcon = computed(() => props.value.appSourceInfo?.icon || 'icon-epinio');

const commitPosition = computed(() => {
  if (!preparedCommits.value.length && !gitDeployment.value.deployedCommit) {
    return null;
  }

  let idx: number | null = null;

  preparedCommits.value.forEach((ele: { commitId: string; }, i: number) => {
    if (ele.commitId === gitDeployment.value?.deployedCommit?.long) {
      idx = i - 1;
    }
  });

  if (idx === null || idx < 0) {
    return {
      text: t('epinio.applications.gitSource.latestCommit'),
      position: 0
    };
  }

  return {
    text: `${idx} ${t('epinio.applications.gitSource.behindCommits')}`,
    position: idx
  };
});

function formatDate(date, from) {
  return from ? day(date).fromNow() : day(date).format('DD MMM YYYY');
}
</script>

<template>
  <div class="content">
    <div class="heading">
      <div class="heading-row">
        <div class="title-content">
          <h1>Application: {{ value.meta.name }}</h1>
          <p>{{ value.stateDisplay }}</p>
        </div>
        <trailhand-button size="small" @button-click="appModal?.openEdit(value)">
          <trailhand-icon name="gear" />
        </trailhand-button>
      </div>
      <h3>Namespace: {{ value.meta.namespace }}</h3>
      <ul>
        <li
          v-for="route in value.configuration.routes"
          :key="route.id"
        >
          <a
            v-if="value.state === 'running'"
            :key="route.id + 'a'"
            :href="`https://${route}`"
            target="_blank"
            rel="noopener noreferrer nofollow"
          >{{ `https://${route}` }}</a>
          <span
            v-else
            :key="route.id + 'b'"
          >{{ `https://${route}` }}</span>
        </li>
      </ul>
    </div>
    <div class="number-cards">
      <trailhand-card class="dashboard-card" variant="info">
        <div slot="title">
          <p class="number-text"><span class="number">{{ value.envCount }}</span> {{ t('epinio.applications.detail.counts.envVars') }}</p>
        </div>
      </trailhand-card>
      <trailhand-card class="dashboard-card" variant="info">
        <div slot="title">
          <p class="number-text"><span class="number">{{ value.serviceConfigurations.length }}</span> {{ t('epinio.applications.detail.counts.services') }}</p>
        </div>
      </trailhand-card>
      <trailhand-card class="dashboard-card" variant="info">
        <div slot="title">
          <p class="number-text"><span class="number">{{ value.baseConfigurations.length }}</span> {{ t('epinio.applications.detail.counts.config') }}</p>
        </div>
      </trailhand-card>
    </div>

    <h3
      v-if="value.deployment"
      class="mt-20"
    >
      {{ t('epinio.applications.detail.deployment.label') }}
    </h3>
    <div
      v-if="value.deployment"
      class="deployment"
    >
      <!-- Source information -->
      <Tabs  :tabs="deploymentTabs" v-model="activeDeploymentTab" variant="underline">
        <template #overview="{ tab }">
          <div class="simple-box-row app-instances">
            <trailhand-card variant="info" class="dashboard-card simple-box">
              <div slot="title" class="consumption-card">
                <div class="instances">
                  <trailhand-progress-bar label="Instances" :value="value.readyInstances" :total="value.desiredInstances"></trailhand-progress-bar>
                  <div class="instances-controls">
                    <trailhand-button variant="secondary" size="small" :disabled="scalingInFlight || value.desiredInstances <= 0" @button-click="updateInstances(value.desiredInstances - 1)">
                      <trailhand-icon name="minus" />
                    </trailhand-button>
                    <div
                      v-if="showScaleSpinner"
                      class="scale-instances__spinner mt-5"
                    >
                      <i class="icon-spinner animate-spin" />
                    </div>
                    <trailhand-button variant="secondary" size="small" :disabled="scalingInFlight" @button-click="updateInstances(value.desiredInstances + 1)">
                      <trailhand-icon name="plus" />
                    </trailhand-button>
                  </div>
                </div>
                <div class="deployment__origin__row">
                  <div
                    class="stats-table"
                  >
                    <table class="mt-15">
                      <thead>
                        <tr>
                          <th />
                          <th>Min</th>
                          <th>Max</th>
                          <th>Avg</th>
                        </tr>
                      </thead>
                      <tbody>
                          <tr>
                              <td>{{ t('tableHeaders.memory') }}</td>
                              <td>{{ value.instanceMemory.min }}</td>
                              <td>{{ value.instanceMemory.max }}</td>
                              <td>{{ value.instanceMemory.avg }}</td>
                          </tr>
                          <tr>
                              <td>{{ t('tableHeaders.cpu') }}</td>
                              <td>{{ value.instanceCpu.min }}</td>
                              <td>{{ value.instanceCpu.max }}</td>
                              <td>{{ value.instanceCpu.avg }}</td>
                          </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </trailhand-card>
            <trailhand-card variant="info" class="dashboard-card simple-box" v-if="value.appSourceInfo">
              <div slot="title" class="deployment__origin__list" >
                <table>
                  <tbody>
                    <tr>
                      <td class="origin-prop">
                        {{ t('epinio.applications.detail.deployment.details.origin') }}
                      </td>
                      <td class="origin-value">
                        {{ value.appSourceInfo.label }}
                      </td>
                    </tr>
                    <tr v-for="d of value.appSourceInfo.details" :key="d.label">
                      <td class="origin-prop">{{ d.label }}</td>
                      <td class="origin-value" v-if="d.value && d.value.startsWith('http')">
                        <a
                          :href="d.value"
                          target="_blank"
                          class="origin-link"
                        >{{ formatURL(d.value) }}</a>
                      </td>
                      <td class="origin-value" v-else-if="gitSource && d.value && d.value.match(/^[a-f0-9]{40}$/)">
                        <a
                          :href="`${gitSource.htmlUrl}/commit/${d.value}`"
                          target="_blank"
                          class="origin-link"
                        >{{ d.value }}</a>
                      </td>
                      <td class="origin-value" v-else>{{ d.value }}</td>
                    </tr>
                    <tr v-if="gitSource">
                      <td class="origin-prop">
                        {{ t('epinio.applications.detail.deployment.details.git.created') }}
                      </td>
                      <td class="origin-value">
                        {{ formatDate(gitSource.created_at, false) }}
                      </td>
                    </tr>
                    <tr v-if="gitSource">
                      <td class="origin-prop">
                        {{ t('epinio.applications.detail.deployment.details.git.updated') }}
                      </td>
                      <td class="origin-value">
                        {{ formatDate(gitSource.updated_at, true) }}
                      </td>
                    </tr>
                    <tr>
                      <td class="origin-prop">
                        {{ t('epinio.applications.tableHeaders.deployedBy') }}
                      </td>
                      <td class="origin-value">
                        {{ value.deployment.username }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </trailhand-card>
          </div>
        </template>
        <template #gitCommits="{ tab }">
          <Banner
            color="info"
            class="redeploy-info"
          >
            {{ t('epinio.applications.detail.deployment.commits.redeploy') }}
          </Banner>
          <trailhand-table
            v-if="preparedCommits"
            :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
            :rows="preparedCommits"
            :columns="gitCommitsColumns"
            key-field="sha"
            :searchable="true"
            :paginated="true"
            :rows-per-page="10"
          />
        </template>
      </Tabs>
    </div>

    <h3 class="mt-20">
      {{ t('epinio.applications.detail.tables.label') }}
    </h3>

    <div>
      <Tabs :tabs="resourceTabs" v-model="activeResourceTab" variant="underline">
        <template #instances="{ tab }">
          <trailhand-table
            :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
            :columns="instanceColumns"
            :rows="value.instances"
            :searchable="false"
            :paginated="false"
          />
        </template>
        <template #services="{ tab }">
          <trailhand-table
            :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
            :columns="serviceColumns"
            :rows="serviceRows"
            :searchable="false"
            :paginated="false"
          />
        </template>
        <template #configs="{ tab }">
          <trailhand-table
            :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
            :columns="configColumns"
            :rows="configRows"
            :searchable="false"
            :paginated="false"
          />
        </template>
      </Tabs>
    </div>
  </div>
  <ServiceInstanceModal ref="serviceModal" />
  <ServiceDeleteModal ref="serviceDeleteModal" />
  <ConfigurationModal ref="configModal" />
  <ConfigurationDeleteModal ref="configDeleteModal" />
  <AppModal ref="appModal" />
</template>

<style lang="scss" scoped>
.heading {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .heading-row {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title-content {
      display: flex;
      align-items: flex-end;
      gap: 10px;

      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
        color: var(--th-color-text-primary);
      }

      p {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        color: var(--th-color-primary);
      }
    }
  }

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 400;
    color: var(--th-color-text-secondary);
  }

  ul {
    margin: 0;
    padding: 0;
    display: flex;
    gap: 10px;

    li {
      list-style: none;
      font-size: 14px;

      a {
        color: var(--th-color-link);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

.number-cards {
  display: flex;
  gap: 8px;
  margin-top: 20px;

  trailhand-card::part(body) {
    display: none;
  }

  trailhand-card::part(action) {
    display: none;
  }

  .dashboard-card {
    .number-text {
      font-size: 14px;
      color: var(--th-color-text-secondary);
      font-weight: 400;
    }

    .number {
      font-size: 24px;
      font-weight: 600;
      color: var(--th-color-text-primary);
    }
  }
}

.instances {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .instances-controls {
    display: flex;
    justify-content: space-between;
  }
}

.content {
  max-width: 1600px;
}

trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}

.simple-box-row {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  grid-gap: 10px;

  @media only screen and (max-width: map-get($breakpoints, '--viewport-9')) {
    grid-auto-flow: row;
  }
  .simple-box {
    width: 100%;
    ul {
      word-break: break-all;
    }
    &:not(:last-of-type) {
      margin-right: 20px;
    }
    .deployment__origin__row {
      display: flex;
      flex-direction: column;
      h4:first-of-type {
        font-weight: bold;
        margin-bottom: 0;
      }
      h4:last-of-type {
        word-break: break-all;
      }
      &:last-of-type {
        h4:last-of-type {
          margin-bottom: 0;
        }
      }
      thead {
        tr {
          th {
            text-align: left;
            color: var(--muted);
            font-weight: 300;
          }
        }
      }
    }

    .scale-instances {
      display: flex;
      align-items: center;

      .plus-minus {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }
  .box {
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    & h1,
    h3 {
      margin-left: 5;
    }
    h3 {
      flex: 1;
      display: flex;
    }
    &-two-cols {
      display: flex;
      h1 {
        font-size: 4.5rem;
        padding: 0 10px;
      }
      div {
        margin-top: 8px;
      }
    }
    &-timers {
      display: flex;
      flex-direction: column;
      h4 {
        font-size: 1.6rem;
      }
      div {
        width: 100%;
        display: flex;
        justify-content: space-between;
      }
    }
  }
}

.stats-table {
  display: flex;
  width: 100%;

  table {
    width: 100%;
  }
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 12px 0;
  position: relative;

  & > div:nth-child(2) {
    display: flex;
    flex-direction: column;
    // align-items: flex-end;
  }

  h3 {
    font-size: 18px;
    font-weight: 500;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;

    li {
      list-style: none;
      font-size: 16px;
      font-weight: 500;

      span {
        font-size: 12px;
        font-weight: 600;
        color: var(--th-color-text-secondary);
      }
    }
  }

  // For the second div in stats, style the ul differently
  & > div:nth-child(2) ul {
    // align-items: flex-end;
  }

}

.deployment__details__header {
  display: flex;
  align-items: center;
  h4 {
    margin: 0
  }
  .git-icon {
    margin: 0 3px 0 -3px;
    font-size: 25px;
  }
}

.scale-instances__spinner {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: var(--muted-text);
}

.deployment__origin__list {
  table {
    width: 100%;
    border-collapse: collapse;

    td {
      padding: 8px 4px;

      &.origin-prop {
        font-size: 12px;
        color: var(--th-color-text-secondary);
        font-weight: 600;
      }

      &.origin-value {
        font-size: 16px;
        color: var(--th-color-text-primary);
        font-weight: 500;
      }
    }
  }

  .origin-link {
    color: var(--th-color-link);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.sortable-table {
  &-avatar {
    display: flex;
    align-items: center;
    justify-content: flex-start;

    img {
      width: 30px;
      height: 30px;
      border-radius: var(--border-radius);
      margin-right: 10px;
    }
  }

  &-commit {
    display: flex;
  }
}

.redeploy-info {
  margin: 0;
}

.live-date{
  color: red !important;
}

:deep(.spaced-row.metadata) {
  display: none !important;
}
</style>
