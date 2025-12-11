<script setup lang="ts">
import '@krumio/trailhand-ui/Components/data-table.js';
import '@krumio/trailhand-ui/Components/action-menu.js';
import { ref, onMounted, nextTick, watch } from 'vue';
import { useStore } from 'vuex';

import Loading from '@shell/components/Loading.vue';
import type { DataTableColumn } from '../components/tables/types';
import AsyncButton from '@shell/components/AsyncButton.vue';

import { EPINIO_MGMT_STORE, EPINIO_TYPES } from '../types';
import { _MERGE } from '@shell/plugins/dashboard-store/actions';
import EpinioCluster, { EpinioInfoPath } from '../models/epiniomgmt/epinio.io.management.cluster';
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import { createDataTable, setupActionListener } from '../utils/table-helpers';

const store = useStore();
const t = store.getters['i18n/t'];

let currentCluster: EpinioCluster | null = null;
let clusters: EpinioCluster[] = [];
let clustersSchema: any = null;

const loading = ref(true);
const error = ref<Error | null>(null);
const tableContainer = ref<HTMLElement | null>(null);

onMounted(async () => {
  loading.value = true
  try {
    await store.dispatch(`${EPINIO_MGMT_STORE}/findAll`, { type: EPINIO_TYPES.CLUSTER }, { root: true })
    clusters = store.getters[`${EPINIO_MGMT_STORE}/all`](EPINIO_TYPES.CLUSTER)
    clustersSchema = store.getters[`${EPINIO_MGMT_STORE}/schemaFor`](EPINIO_TYPES.CLUSTER)

    clusters.forEach((c: EpinioCluster) => testCluster(c))
  } catch (err) {
    error.value = err as Error
  } finally {
    loading.value = false
    await nextTick();
    createOrUpdateTable();
  }
})

// Watch for clusters changes
watch(() => clusters, async () => {
  await nextTick();
  createOrUpdateTable();
}, { deep: true });

const canRediscover = () => {
  return !clusters.find((c: EpinioCluster) => c.state === 'updating');
}

const rediscover = async (buttonCb: (success: boolean) => void)  => {
  await store.dispatch(
    `${ EPINIO_MGMT_STORE }/findAll`,
    { type: EPINIO_TYPES.CLUSTER, opt: { force: true, load: _MERGE } },
  );
  clusters.forEach((c: EpinioCluster) => testCluster(c));
  buttonCb(true);
}

const login = async (c: EpinioCluster) =>{
  const isLoggedIn = await epinioAuth.isLoggedIn(c.createAuthConfig(EpinioAuthTypes.AGNOSTIC));

  if (isLoggedIn) {
    store.$router.push({
      name:   'epinio-c-cluster-dashboard',
      params: { cluster: c.id }
    });
  } else {
    currentCluster = c;
    store.dispatch('cluster/promptModal', {
      component: 'LoginDialog',
      componentProps: {
        cluster: currentCluster,
      },
    });
  }
}

const setClusterState = (
  cluster: EpinioCluster,
  state: string,
  metadataStateObj: {
    state: {
      transitioning: boolean,
      error: boolean,
      message: string
    }
  }) => {
  cluster['state'] = state;
  cluster['metadata'] = metadataStateObj;
}

const testCluster = (c: EpinioCluster) => {
  // Call '/ready' on each cluster. If there's a network error there's a good chance the user has to permit an invalid cert
  setClusterState(c, 'updating', {
    state: {
      transitioning: true,
      error:        false,
      message:       'Contacting...'
    }
  });

  store.dispatch(
    `epinio/request`,
    { opt: { url: EpinioInfoPath, redirectUnauthorized: false }, clusterId: c.id }
  )
  .then((res: any) => {
    c['version'] = res?.version;
    c['oidcEnabled'] = res?.oidc_enabled;
    setClusterState(
      c,
      'available',
      { state: { transitioning: false, error: false, message: "" } },
    );
    // Trigger table update
    createOrUpdateTable();
  })
  .catch((e: Error) => {
    if (e.message === 'Network Error') {
      setClusterState(c, 'error', {
        state: {
          transitioning: false,
          error:   true,
          message: `Network Error. It may be that the certificate isn't trusted.
            Click on the URL above if you'd like to bypass checks and then refresh`
        }
      });
    } else {
      setClusterState(c, 'error', {
        state: {
          transitioning: false,
          error:   true,
          message: `Failed to check the ready state: ${ e }`
        }
      });
    }
    // Trigger table update
    createOrUpdateTable();
  });
}

// Custom formatters
const formatName = (value: any, row: any) => {
  if (row.state === 'available') {
    return `<a style="cursor: pointer;" data-cluster-id="${row.id}">${row.name}</a>`;
  }
  return row.name;
};

const formatApi = (value: any, row: any) => {
  if (row.state !== 'available') {
    return `<a href="${row.infoUrl}" target="_blank" rel="noopener noreferrer">${row.api}</a>`;
  }
  return row.api;
};

const columns: DataTableColumn[] = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px'
  },
  {
    field: 'name',
    label: 'Name',
    formatter: formatName
  },
  {
    field: 'api',
    label: 'API',
    formatter: formatApi
  },
  {
    field: 'version',
    label: 'Version'
  }
];

// Create and update table
const createOrUpdateTable = () => {
  if (!tableContainer.value) return;

  tableContainer.value.innerHTML = '';

  const tableElement = createDataTable(columns, clusters);
  setupActionListener(tableElement);
  tableContainer.value.appendChild(tableElement);

  // Add click listener for name links
  tableContainer.value.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' && target.hasAttribute('data-cluster-id')) {
      e.preventDefault();
      const clusterId = target.getAttribute('data-cluster-id');
      const cluster = clusters.find((c: EpinioCluster) => c.id === clusterId);
      if (cluster) {
        login(cluster);
      }
    }
  });
};
</script>

<template>
  <Loading
    v-if="loading"
    mode="main"
  />
  <div
    v-else-if="clusters.length === 0"
    class="root"
  >
    <h2>{{ t('epinio.instances.none.header') }}</h2>
    <p>{{ t('epinio.instances.none.description') }}</p>
  </div>
  <div
    v-else
    class="root"
  >
    <div class="epinios-table">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2>{{ t('epinio.instances.header') }}</h2>
        <AsyncButton
          mode="refresh"
          size="sm"
          :disabled="!canRediscover()"
          style="display:inline-flex"
          @click="rediscover"
        />
      </div>
      <div ref="tableContainer"></div>

    </div>

</div>
</template>

<style lang="scss" scoped>

div.root {
  align-items: center;
  padding-top: 50px;
  display: flex;

  .epinios-table {
    & > h4 {
      padding-top: 50px;
      padding-bottom : 20px;
    }
    min-width: 60%;

    .epinio-row {
      height: 40px;
      display: flex;
      align-items: center;

      a {
        cursor: pointer;
      }
    }
  }
}

</style>
