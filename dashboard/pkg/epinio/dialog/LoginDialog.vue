<script>
import GenericPrompt from '@shell/dialog/GenericPrompt';
import Banner from '@components/Banner/Banner.vue';
import Tabbed from '@shell/components/Tabbed/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import { APPLICATION_PARTS } from '../types';
import JSZip from 'jszip';
import { downloadFile } from '@shell/utils/download';
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import Password from '@shell/components/form/Password';
import { LabeledInput } from '@components/Form/LabeledInput';
// import { EpinioCluster } from '../utils/epinio-discovery';

export default {
  name:       'LoginDialog',
  components: {
    GenericPrompt, Banner, Tabbed, Tab, LabeledInput, Password
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },
  data() {
    return {
      selectedTab: '',
      username:    '',
      password:    '',
      config:      {
        title:       'TODO: RC', // this.t('promptRemove.title'),
        applyMode:   'login',
        applyAction: this.login,
      }
    };
  },

  methods: {
    async login() {
      const cluster = this.resources[0];

      try {
        switch (this.selectedTab) {
        case 'local':
          await epinioAuth.login({
            type:        EpinioAuthTypes.LOCAL,
            epinioUrl:   cluster.api,
            localConfig: {
              username: this.username,
              password: this.password
            }
          }); // TODO: RC error handling. if popup closed this doesn't throw error
          break;
        case 'dex':
          await epinioAuth.login({
            type:      EpinioAuthTypes.DEX,
            epinioUrl: cluster.api,
            dexConfig: {
              dashboardUrl: window.origin, // 'https://localhost:8005', // TODO: RC get current url
              dexUrl:       `https://auth.46.101.17.26.nip.io`, // TODO: RC from config
            },
          }); // TODO: RC error handling. if popup closed this doesn't throw error
          break;
        }
      } catch (e) {
        // TODO: RC
        return;
      }

      // TODO: RC tidy up UX for click. tie in error handling?
      // TODO: RC wire in logout when leave cluster, log out of dashboard
      // TODO: RC what happens on refresh, is it still there... avoid sign in if we have a user?
      this.$router.push({
        name:   'epinio-c-cluster-dashboard',
        params: { cluster: cluster.id }
      });
    },

    async dexLogin(c) {

    },

    tabChanged({ tab, selectedName }) {
      this.selectedTab = selectedName;
    }
  }
};
</script>

<template>
  <GenericPrompt
    v-bind="config"
    @close="$emit('close')"
  >
    <h4
      slot="title"
      class="text-default-text login-dialog__title"
    >
      Log in
      <!-- {{ t('epinio.applications.export.label') }} -->
    </h4>

    <template slot="body">
      <Tabbed
        @changed="tabChanged"
      >
        <!-- label-key="epinio.applications.export.manifest.title" -->
        <Tab
          label="Local"
          name="local"
          :weight="3"
          class="login-dialog__tab"
        >
          <form>
            <div class="span-10 offset-1">
              <div class="mb-20">
                <LabeledInput
                  id="username"
                  ref="username"
                  v-model.trim="username"
                  data-testid="local-login-username"
                  :label="t('login.username')"
                  autocomplete="epinio-username"
                />
              </div>
              <div class="">
                <Password
                  id="password"
                  ref="password"
                  v-model="password"
                  data-testid="local-login-password"
                  :label="t('login.password')"
                  autocomplete="epinio-password"
                />
              </div>
            </div>
          </form>
        </Tab>

        <!-- label-key="epinio.applications.export.chart.title" -->
        <Tab

          label="Auth Provider"
          name="dex"
          :weight="2"
          class="login-dialog__tab"
        >
          <p>
            <!-- {{ t('epinio.applications.export.chart.description') }} -->
            Login via Auth Provider
          </p>
        </Tab>
      </Tabbed>
    </template>
  </GenericPrompt>
</template>
<style lang='scss' scoped>
.login-dialog {
  &__title {
    margin-bottom: 0;
  }
  &__tab {
    min-height: 145px;
  }
}
</style>
