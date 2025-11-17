<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useStore } from 'vuex';

import Loading from '@shell/components/Loading.vue';
import ResourceTable from '@shell/components/ResourceTable.vue';
import AsyncButton from '@shell/components/AsyncButton.vue';

import { EPINIO_MGMT_STORE, EPINIO_TYPES } from '../types';
import { _MERGE } from '@shell/plugins/dashboard-store/actions';
import EpinioCluster, { EpinioInfoPath } from '../models/epiniomgmt/epinio.io.management.cluster';
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';

const store = useStore();
const t = store.getters['i18n/t'];

let currentCluster: EpinioCluster | null = null;
let clusters: EpinioCluster[] = [];
let clustersSchema: any = null;

const loading = ref(true);
const error = ref<Error | null>(null)

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
  }
})

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
      <h2>{{ t('epinio.instances.header') }}</h2>
      <ResourceTable
        :rows="clusters"
        :schema="clustersSchema"
        :table-actions="false"
      >
        <template #header-left>
          <AsyncButton
            mode="refresh"
            size="sm"
            :disabled="!canRediscover"
            style="display:inline-flex"
            @click="rediscover"
          />
        </template>
        <template #cell:name="{row}">
          <div class="epinio-row">
            <a
              v-if="row.state === 'available'"
              @click="login(row)"
            >{{ row.name }}</a>
            <template v-else>
              {{ row.name }}
            </template>
          </div>
        </template>
        <template #cell:api="{row}">
          <div class="epinio-row">
            <Link
              v-if="row.state !== 'available'"
              :row="row"
              :value="{ text: row.api, url: row.infoUrl }"
            />
            <template v-else>
              {{ row.api }}
            </template>
          </div>
        </template>
      </ResourceTable>

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
