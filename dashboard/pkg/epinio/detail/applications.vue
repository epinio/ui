<script setup lang="ts">
import { ref, computed, defineProps, onMounted } from 'vue';
import { useStore } from 'vuex';
import day from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import Application from '../models/applications';
import SimpleBox from '@shell/components/SimpleBox.vue';
import { GitUtils } from '@shell/utils/git';
import { isArray } from '@shell/utils/array';
import ConsumptionGauge from '@shell/components/ConsumptionGauge.vue';
import { APPLICATION_MANIFEST_SOURCE_TYPE, EPINIO_TYPES } from '../types';
import DataTable from '../components/tables/DataTable.vue';
import type { DataTableColumn } from '../components/tables/types';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter.vue';
import PlusMinus from '@shell/components/form/PlusMinus.vue';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import ApplicationCard from '../components/application/AppCardDetail.vue';
import Tabbed from '@shell/components/Tabbed/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import AppGitDeployment from '../components/application/AppGitDeployment.vue';
import Link from '@shell/components/formatter/Link.vue';
import Banner from '@components/Banner/Banner.vue';

day.extend(relativeTime);

const props = defineProps<{
  value: Application;
  initialValue: Application;
  mode: string;
}>();

const store = useStore();

const t = store.getters['i18n/t'];

const saving = ref(false);
const gitSource = ref<any>(null);
const gitDeployment = ref({
  deployedCommit: { short: '', long: '' },
  commits: null as any
});

const instanceColumns: DataTableColumn[] = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px'
  },
  {
    field: 'name',
    label: 'Name'
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
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];

const serviceColumns: DataTableColumn[] = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px'
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

const configColumns: DataTableColumn[] = [
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

const commitActions = [{
  action: 'editFromCommit',
  label: t('epinio.applications.actions.editFromCommit.label'),
  icon: 'icon icon-edit',
  enabled: true
}];

onMounted(async () => {
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION });

  if (props.value.appSource.git) {
    await fetchRepoDetails();
    setCommitDetails();
  }
});

async function updateInstances(newInstances: number) {
  saving.value = true;
  try {
    props.value.configuration.instances = newInstances;
    await props.value.update();
    await props.value.forceFetch();
  } catch (err) {
    console.error(`Failed to scale Application: `, epinioExceptionToErrorsArray(err));
  }
  saving.value = false;
}

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
    editFromCommit: () => props.value.goToEdit({ commit: c.sha || c.id })
  }));
});

const gitCommitsColumns = computed<DataTableColumn[]>(() => [
  {
    field: 'sha',
    label: t(`gitPicker.${gitType.value}.tableHeaders.sha.label`),
    width: '100px'
  },
  {
    field: 'author_login',
    label: t(`gitPicker.${gitType.value}.tableHeaders.author.label`),
    width: '190px'
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
</script>

<template>
  <div class="content">
    <div class="application-details">
      <ApplicationCard>
        <!-- Icon slot -->
        <template #cardIcon>
          <i
            class="icon icon-fw"
            :class="sourceIcon"
          />
        </template>

        <!-- Routes links slot -->
        <template #top-left>
          <h1>Routes</h1>
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
        </template>

        <!-- <template v-slot:top-right>
        </template> -->

        <!-- Resources count slot -->
        <template #resourcesCount>
          <div>
            {{ value.envCount }} {{ t('epinio.applications.detail.counts.envVars') }}
          </div>
          <div>
            {{ value.serviceConfigurations.length }} {{ t('epinio.applications.detail.counts.services') }}
          </div>
          <div>
            {{ value.baseConfigurations.length }} {{ t('epinio.applications.detail.counts.config') }}
          </div>
        </template>
      </ApplicationCard>
    </div>

    <h3 class="mt-20">
      {{ t('epinio.applications.detail.deployment.label') }}
    </h3>

    <div class="deployment">
      <!-- Source information -->
      <Tabbed>
        <Tab
          label-key="epinio.applications.detail.tables.overview"
          name="overview"
          :weight="3"
        >
          <div class="simple-box-row app-instances">
            <SimpleBox>
              <ConsumptionGauge
                :resource-name="t('epinio.applications.detail.deployment.instances')"
                :capacity="value.desiredInstances"
                :used="value.readyInstances"
                :used-as-resource-name="true"
                :color-stops="{ 70: '--success', 30: '--warning', 0: '--error' }"
              />
              <div class="scale-instances">
                <PlusMinus
                  v-model:value="value.desiredInstances"
                  class="mt-15 mb-10"
                  :disabled="saving"
                  @minus="updateInstances(value.desiredInstances - 1)"
                  @plus="updateInstances(value.desiredInstances + 1)"
                />
              </div>

              <div class="deployment__origin__row">
                <hr class="mt-10 mb-10">
                <h4 class="mt-10 mb-10">
                  {{ t('epinio.applications.detail.deployment.metrics') }}
                </h4>
                <div
                  v-if="gitSource"
                  class="stats"
                >
                  <div>
                    <h3>{{ t('tableHeaders.memory') }}</h3>
                    <ul>
                      <li> <span>Min: </span> {{ value.instanceMemory.min }}</li>
                      <li> <span>Max: </span>{{ value.instanceMemory.max }}</li>
                      <li><span>Avg: </span>{{ value.instanceMemory.avg }}</li>
                    </ul>
                  </div>
                  <div>
                    <h3>{{ t('tableHeaders.cpu') }}</h3>
                    <ul>
                      <li> <span>Min: </span> {{ value.instanceCpu.min }}</li>
                      <li> <span>Max: </span>{{ value.instanceCpu.max }}</li>
                      <li><span>Avg: </span>{{ value.instanceCpu.avg }}</li>
                    </ul>
                  </div>
                </div>

                <div
                  v-else
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
            </SimpleBox>
            <SimpleBox v-if="value.appSourceInfo">
              <div class="mb-10 deployment__details__header">
                <i
                  v-if="value.appSourceInfo.kind === APPLICATION_MANIFEST_SOURCE_TYPE.GIT"
                  class="icon git-icon"
                  :class="{[`icon-${gitType}`]: true}"
                />
                <h4>{{ t('epinio.applications.detail.deployment.details.label') }}</h4>
              </div>
              <div
                v-if="gitSource"
                class="repo-info"
              >
                <AppGitDeployment
                  :git-deployment="gitDeployment"
                  :git-source="gitSource"
                  :commit-position="commitPosition"
                />
              </div>
              <hr class="mt-10 mb-10">
              <div class="deployment__origin__list">
                <ul>
                  <li>
                    <h4>{{ t('epinio.applications.detail.deployment.details.origin') }}</h4>
                    <span>{{ value.appSourceInfo.label }}</span>
                  </li>

                  <li
                    v-for="d of value.appSourceInfo.details"
                    :key="d.label"
                  >
                    <h4>{{ d.label }}</h4>
                    <span v-if="d.value && d.value.startsWith('http')">
                      <a
                        :href="d.value"
                        target="_blank"
                      >{{ formatURL(d.value) }}</a>
                    </span>
                    <span v-else-if="gitSource && d.value && d.value.match(/^[a-f0-9]{40}$/)">
                      <a
                        :href="`${gitSource.htmlUrl}/commit/${d.value}`"
                        target="_blank"
                      >{{ d.value }}</a>
                    </span>
                    <span v-else>{{ d.value }}</span>
                  </li>

                  <li v-if="value.deployment">
                    <h4>{{ t('epinio.applications.tableHeaders.deployedBy') }}</h4>
                    <span> {{ value.deployment.username }}</span>
                  </li>
                </ul>
              </div>
            </SimpleBox>
          </div>
        </Tab>
        <Tab
          v-if="gitSource && preparedCommits.length"
          label-key="epinio.applications.detail.tables.gitCommits"
          name="gitCommits"
          :weight="2"
        >
          <Banner
            color="info"
            class="redeploy-info"
          >
            {{ t('epinio.applications.detail.deployment.commits.redeploy') }}
          </Banner>
          <DataTable
            v-if="preparedCommits"
            :rows="preparedCommits"
            :columns="gitCommitsColumns"
            key-field="sha"
            :searchable="true"
            :paginated="true"
            :rows-per-page="10"
          >
            <template #cell:author_login="{row}">
              <div class="sortable-table-avatar">
                <template v-if="row.author">
                  <img
                    :src="row.author.avatarUrl"
                    alt=""
                  >
                  <a
                    :href="row.author.htmlUrl"
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                  >
                    {{ row.author.name }}
                  </a>
                </template>
                <template v-else>
                  {{ t(`gitPicker.${ gitType }.tableHeaders.author.unknown`) }}
                </template>
              </div>
            </template>

            <template #cell:sha="{row}">
              <div class="sortable-table-commit">
                <Link
                  v-model:value="row.sha"
                  :row="row"
                  url-key="htmlUrl"
                />
                <i
                  v-if="row.commitId === gitDeployment.deployedCommit.long"
                  v-tooltip="t('epinio.applications.detail.deployment.details.git.deployed')"
                  class="icon icon-fw icon-commit"
                />
              </div>
            </template>
          </DataTable>
        </Tab>
      </Tabbed>
    </div>

    <h3 class="mt-20">
      {{ t('epinio.applications.detail.tables.label') }}
    </h3>

    <div>
      <Tabbed>
        <Tab
          label-key="epinio.applications.detail.tables.instances"
          name="instances"
          :weight="3"
        >
          <DataTable
            :columns="instanceColumns"
            :rows="value.instances"
            :searchable="false"
            :paginated="false"
          >
            <template #cell:stateDisplay="{ row }">
              <BadgeStateFormatter
                :row="row"
                :value="row.stateDisplay"
              />
            </template>
          </DataTable>
        </Tab>
        <Tab
          label-key="epinio.applications.detail.tables.services"
          name="services"
          :weight="2"
        >
          <DataTable
            :columns="serviceColumns"
            :rows="value.services"
            :searchable="false"
            :paginated="false"
          >
            <template #cell:stateDisplay="{ row }">
              <BadgeStateFormatter
                :row="row"
                :value="row.stateDisplay"
              />
            </template>
          </DataTable>
        </Tab>
        <Tab
          label-key="epinio.applications.detail.tables.configs"
          name="configs"
          :weight="1"
        >
          <DataTable
            :columns="configColumns"
            :rows="value.baseConfigurations"
            :searchable="false"
            :paginated="false"
          >
            <template #cell:stateDisplay="{ row }">
              <BadgeStateFormatter
                :row="row"
                :value="row.stateDisplay"
              />
            </template>
          </DataTable>
        </Tab>
      </Tabbed>
    </div>

  </div>
</template>

<style lang="scss" scoped>
.content {
  max-width: 1600px;
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

  &::before {
    content: "";
    border-right: 1px solid var(--default);
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
  }

  & > div:nth-child(2) {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  h3 {
    font-size: 16px;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;

    li {
      list-style: none;
      font-size: 14px;
    }
  }

  // For the second div in stats, style the ul differently
  & > div:nth-child(2) ul {
    align-items: flex-end;
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

.deployment__origin__list {
  ul {
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;

    li {
      margin: 5px;
      list-style: none;

      h4 {
        color: var(--default-text);
        font-weight: 300;
        font-size: 14px;
        margin: 0;
      }
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
