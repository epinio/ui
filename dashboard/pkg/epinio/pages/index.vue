<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useStore } from 'vuex';

import Loading from '@shell/components/Loading.vue';
import AsyncButton from '@shell/components/AsyncButton.vue';
import { MANAGEMENT } from '@shell/config/types';

import { EPINIO_MGMT_STORE, EPINIO_TYPES } from '../types';
import { _MERGE } from '@shell/plugins/dashboard-store/actions';
import EpinioCluster, { EpinioInfoPath } from '../models/epiniomgmt/epinio.io.management.cluster';
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import { makeEmptyCell, makeStateTag } from '../utils/table-formatters';

const store = useStore();
const t = store.getters['i18n/t'];

const clusters = ref<EpinioCluster[]>([]);
const currentCluster = ref<EpinioCluster | null>(null);
const allClusters = ref<any>(null);

const loading = ref(true);
const error = ref<Error | null>(null)

const displayClusters = computed(() => {
  const formattedRancherClusters = allClusters.value.filter((cluster: any) => {
    const epinioCluster = clusters.value.find((c: EpinioCluster) => c.id === cluster.id);
    return !epinioCluster;
  }).map((rancherCluster: any) => {
    const uninstalledCluster = new EpinioCluster({
      id:          rancherCluster.id,
      name:        rancherCluster.spec.displayName,
      namespace:   '',
      api:         null,
      loggedIn:    false,
      mgmtCluster: rancherCluster,
    }, { rootGetters: store.getters });

    // Manually set the state after construction
    uninstalledCluster.state = 'uninstalled';
    uninstalledCluster.metadata = {
      state: {
        transitioning: false,
        error:        false,
        message:      'Epinio not installed'
      }
    };

    return uninstalledCluster;
  })
  const mergedClusters = [...clusters.value, ...formattedRancherClusters];
  return mergedClusters;
})

onMounted(async () => {
  loading.value = true
  try {
    await store.dispatch('management/findAll', { type: MANAGEMENT.CLUSTER });
    allClusters.value = store.getters['management/all'](MANAGEMENT.CLUSTER);

    await store.dispatch(`${EPINIO_MGMT_STORE}/findAll`, { type: EPINIO_TYPES.CLUSTER }, { root: true })
    clusters.value = store.getters[`${EPINIO_MGMT_STORE}/all`](EPINIO_TYPES.CLUSTER)

    clusters.value.forEach((c: EpinioCluster) => testCluster(c))
  } catch (err) {
    error.value = err as Error
  } finally {
    loading.value = false
  }
})

const canRediscover = () => {
  return !displayClusters.value.find((c: EpinioCluster) => c.state === 'updating');
}

const rediscover = async (buttonCb: (success: boolean) => void)  => {
  await store.dispatch(
    `${ EPINIO_MGMT_STORE }/findAll`,
    { type: EPINIO_TYPES.CLUSTER, opt: { force: true, load: _MERGE } },
  );
  displayClusters.value.forEach((c: EpinioCluster) => testCluster(c));
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
    currentCluster.value = c;
    store.dispatch('cluster/promptModal', {
      component: 'LoginDialog',
      componentProps: {
        cluster: currentCluster.value,
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
  });
}

const columns = [
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
      if (row.state === 'available') {
        const a = document.createElement('a');

        a.textContent = row.name;
        a.style.cursor = 'pointer';
        a.addEventListener('click', () => login(row));

        return a;
      }

      const span = document.createElement('span');

      span.textContent = row.name || '';

      return span;
    }
  },
  {
    field: 'api',
    label: 'API',
    formatter: (_v: any, row: any) => {
      if (row.state === 'uninstalled') return makeEmptyCell();

      if (row.state !== 'available') {
        const a = document.createElement('a');

        a.href = row.infoUrl || '#';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = row.api || '';

        return a;
      }

      const span = document.createElement('span');

      span.textContent = row.api || '';

      return span;
    }
  },
  {
    field: 'version',
    label: 'Version'
  }
];
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
      <div style="justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2>{{ t('epinio.instances.header') }}</h2>
        <AsyncButton
          mode="refresh"
          size="sm"
          :disabled="!canRediscover()"
          style="display:inline-flex;"
          @click="rediscover"
        />
      </div>
      <data-table
        :rows="displayClusters"
        :columns="columns"
        :searchable="false"
        key-field="id"
      />
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
      padding-bottom: 20px;
    }
    min-width: 60%;
  }
}

data-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
}
</style>

