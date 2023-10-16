<script>
import GenericPrompt from '@shell/dialog/GenericPrompt';
import Tabbed from '@shell/components/Tabbed/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import Password from '@shell/components/form/Password';
import { LabeledInput } from '@components/Form/LabeledInput';

export default {
  name: 'LoginDialog',

  components: {
    GenericPrompt, Tabbed, Tab, LabeledInput, Password
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
        applyMode:   'login',
        applyAction: this.login,
      },
      tab: {
        local: 'local',
        dex:   'dex'
      }
    };
  },

  computed: {
    cluster() {
      return this.resources[0];
    }
  },

  mounted() {
    console.warn(this.cluster.oidcEnabled);

    if (!this.cluster.oidcEnabled) {
      this.selectedTab = this.tab.local;
    }
  },

  methods: {
    async login() {
      const errors = [];

      switch (this.selectedTab) {
      case this.tab.local:
        if (!this.username) {
          errors.push('Username');
        }
        if (!this.password) {
          errors.push('Password');
        }
        if (errors.length) {
          return Promise.reject(new Error(`${ errors.join('/') } Required`));
        }

        await epinioAuth.login(this.cluster.createAuthConfig(EpinioAuthTypes.LOCAL, {
          username: this.username,
          password: this.password,
          $axios:   this.$axios,
        }));
        break;
      case this.tab.dex:
        await epinioAuth.login(this.cluster.createAuthConfig(EpinioAuthTypes.DEX));

        break;
      default:
        throw new Error(`Unknown log in type: ${ this.selectedTab }`);
      }

      this.cluster.loggedIn = true;

      this.$router.push({
        name:   'epinio-c-cluster-dashboard',
        params: { cluster: this.cluster.id }
      });
    },

    tabChanged({ selectedName }) {
      this.selectedTab = selectedName;
    },

    close() {
      this.$emit('close', false);
    }
  }
};
</script>

<template>
  <GenericPrompt
    v-bind="config"
    @close="close"
  >
    <h4
      slot="title"
      class="text-default-text login-dialog__title"
    >
      {{ t('epinio.login.modal.title') }}
    </h4>

    <template slot="body">
      <Tabbed
        v-if="cluster.oidcEnabled"
        @changed="tabChanged"
      >
        <Tab
          label-key="epinio.login.modal.local.tabLabel"
          :name="tab.local"
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
                  :required="true"
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
                  :required="true"
                />
              </div>
            </div>
          </form>
        </Tab>
        <Tab
          label-key="epinio.login.modal.dex.tabLabel"
          :name="tab.dex"
          :weight="2"
          class="login-dialog__tab"
        >
          <p>
            {{ t('epinio.login.modal.dex.prompt') }}
          </p>
        </Tab>
      </Tabbed>
      <form v-else>
        <div class="span-10 offset-1 mt-15">
          <div class="mb-20">
            <LabeledInput
              id="username"
              ref="username"
              v-model.trim="username"
              data-testid="local-login-username"
              :label="t('login.username')"
              autocomplete="epinio-username"
              :required="true"
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
              :required="true"
            />
          </div>
        </div>
      </form>
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
