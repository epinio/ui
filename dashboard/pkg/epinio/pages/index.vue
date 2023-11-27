<script lang="ts">
import Vue from 'vue';

import Loading from '@shell/components/Loading.vue';
import Link from '@shell/components/formatter/Link.vue';
import ResourceTable from '@shell/components/ResourceTable.vue';
import { EPINIO_MGMT_STORE, EPINIO_TYPES } from '../types';

import AsyncButton from '@shell/components/AsyncButton.vue';
import { _MERGE } from '@shell/plugins/dashboard-store/actions';
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import EpinioCluster, { EpinioInfoPath } from '../models/cluster';
import LoginDialog from '../components/LoginDialog.vue';
import Dialog from '@shell/components/Dialog.vue';
import { STATES_ENUM } from '@shell/plugins/dashboard-store/resource-class';
import { Banner } from '@components/Banner';

interface Data {
  clustersSchema: any;
}

// Data, Methods, Computed, Props
export default Vue.extend<Data, any, any, any>({
  components: {
    AsyncButton, Loading, Link, ResourceTable, LoginDialog, Dialog, Banner
  },

  layout: 'plain',

  async fetch() {
    await this.$store.dispatch(`${ EPINIO_MGMT_STORE }/findAll`, { type: EPINIO_TYPES.CLUSTER });

    this.clusters.forEach((c: EpinioCluster) => this.testCluster(c));
  },

  data() {
    return {
      clustersSchema: this.$store.getters[`${ EPINIO_MGMT_STORE }/schemaFor`](EPINIO_TYPES.CLUSTER),
      version:        null,
      infoUrl:        EpinioInfoPath,
      currentCluster: {},
      UNINSTALLED:    STATES_ENUM.UNINSTALLED,
    };
  },

  mounted() {
    window.addEventListener('visibilitychange', this.visibilitychange);
  },

  beforeDestroy() {
    window.removeEventListener('visibilitychange', this.visibilitychange);
  },

  computed: {
    cluster(): string {
      return this.$route.params.cluster;
    },

    product(): string {
      return this.$route.params.product;
    },

    canRediscover() {
      return !this.clusters.find((c: EpinioCluster) => c.state === 'updating');
    },

    clusters() {
      return this.$store.getters[`${ EPINIO_MGMT_STORE }/all`](EPINIO_TYPES.CLUSTER);
    },

    installedClusters() {
      return this.clusters.find((c: EpinioCluster) => c.installed);
    }
  },

  methods: {
    async rediscover(buttonCb: (success: boolean) => void) {
      await this.$store.dispatch(`${ EPINIO_MGMT_STORE }/findAll`, { type: EPINIO_TYPES.CLUSTER, opt: { force: true, load: _MERGE } });
      this.clusters.forEach((c: EpinioCluster) => this.testCluster(c));
      buttonCb(true);
    },

    visibilitychange() {
      if (this.canRediscover && document.visibilityState === 'visible') {
        this.rediscover(() => undefined);
      }
    },

    setClusterState(cluster: EpinioCluster, state: string, metadataStateObj: { state: { transitioning: boolean, error: boolean, message: string }}) {
      Vue.set(cluster, 'state', state);
      Vue.set(cluster, 'metadata', metadataStateObj);
    },

    testCluster(c: EpinioCluster) {
      if (!c.installed) {
        this.setClusterState(c, STATES_ENUM.UNINSTALLED, { state: { transitioning: false } });

        return;
      }
      // Call '/ready' on each cluster. If there's a network error there's a good chance the user has to permit an invalid cert
      this.setClusterState(c, 'updating', {
        state: {
          transitioning: true,
          message:       'Contacting...'
        }
      });

      this.$store.dispatch(`epinio/request`, { opt: { url: this.infoUrl, redirectUnauthorized: false }, clusterId: c.id })
        .then((res: any) => {
          Vue.set(c, 'version', res?.version);
          Vue.set(c, 'oidcEnabled', res?.oidc_enabled);
          this.setClusterState(c, 'available', { state: { transitioning: false } });
        })
        .catch((e: Error) => {
          if (e.message === 'Network Error') {
            this.setClusterState(c, 'error', {
              state: {
                error:   true,
                message: `Network Error. It may be that the certificate isn't trusted. Click on the URL above if you'd like to bypass checks and then refresh`
              }
            });
          } else {
            this.setClusterState(c, 'error', {
              state: {
                error:   true,
                message: `Failed to check the ready state: ${ e }`
              }
            });
          }
        });
    },

    async login(c: EpinioCluster) {
      const isLoggedIn = await epinioAuth.isLoggedIn(c.createAuthConfig(EpinioAuthTypes.AGNOSTIC));

      if (isLoggedIn) {
        this.$router.push({
          name:   'epinio-c-cluster-dashboard',
          params: { cluster: c.id }
        });
      } else {
        this.currentCluster = c;
        this.$modal.show('epinio-login-dialog');
      }
    },

    closeDialog() {
      this.$modal.hide('epinio-login-dialog');
    }
  }

});
</script>

<template>
  <Loading
    v-if="$fetchState.pending"
    mode="main"
  />
  <div
    v-else
    class="root"
  >
    <div class="epinios-table">
      <h2>{{ t('epinio.instances.header') }}</h2>
      <div v-if="installedClusters.length === 0">
        <Banner
          class="none"
          color="info"
          :labelKey="'epinio.instances.none.description'"
        />
      </div>
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
            <template v-if="row.state === UNINSTALLED" />
            <Link
              v-else-if="row.state !== 'available'"
              :row="row"
              :value="{ text: row.api, url: row.infoUrl }"
            />
            <template v-else>
              {{ row.api }}
            </template>
          </div>
        </template>
        <template #cell:rancherCluster="{row}">
          <div class="epinio-row">
            <nuxt-link
              :to="{ name: 'c-cluster-explorer', params: { cluster: row.id } }"
            >
              {{ row.nameDisplay }}
            </nuxt-link>
          </div>
        </template>
      </ResourceTable>
    </div>
    <Dialog
      name="epinio-login-dialog"
      :title="''"
      style="width:'340px'"
    >
      <template #buttons>
        <button
          class="btn role-secondary"
          @click="closeDialog(false)"
        >
          {{ t('generic.cancel') }}
        </button>
      </template>
      <template>
        <LoginDialog :cluster="currentCluster" />
      </template>
    </Dialog>
  </div>
</template>

<style lang="scss">
div.root .epinios-table {
  .banner__content  {
    span {
      text-align: center;
    }

    align-items: center;
    display: flex;
    flex-direction: column;
  }
}
</style>

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
