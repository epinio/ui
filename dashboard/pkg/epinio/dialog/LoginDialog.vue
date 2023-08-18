<script>
import GenericPrompt from '@shell/dialog/GenericPrompt';
import Tabbed from '@shell/components/Tabbed/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import Password from '@shell/components/form/Password';
import { LabeledInput } from '@components/Form/LabeledInput';
// import { EpinioCluster } from '../utils/epinio-discovery';

export default {
  name:       'LoginDialog',
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
      }
    };
  },

  methods: {
    // async loginWrapper(buttonDone) {
    //   try {
    //     await this.login(buttonDone);
    //     this.close();
    //   } catch (err) {
    //     console.error(err); // eslint-disable-line
    //     this.errors = epinioExceptionToErrorsArray(err);
    //     buttonDone(false);
    //   }
    // },

    async login() {
      const cluster = this.resources[0];
      const errors = [];

      switch (this.selectedTab) {
      case 'local':
        if (!this.username) {
          errors.push('Username');
        }
        if (!this.password) {
          errors.push('Password');
        }
        if (errors.length) {
          return Promise.reject(new Error(`${ errors.join('/') } Required`));
        }

        await epinioAuth.login(cluster.createAuthConfig(EpinioAuthTypes.LOCAL, {
          username: this.username,
          password: this.password,
          $axios:   this.$axios,
        }));
        break;
      case 'dex':
        await epinioAuth.login(cluster.createAuthConfig(EpinioAuthTypes.DEX));

        break;
      }

      // TODO: RC behaviour
      // Local User credentials do not persist over refresh. Refreshing on an epinio page will redirect the user to the epinio list
      // Dex User credentials are stored in sessions storage so do persist over refresh
      // If the user wants to log out, either to remove the current visits local user or the session storage dex credentials, they can log out in the epinio list
      // Discussion - If the user logs out of Rancher should they also be logged out of all epinio clusters?

      // TODO: RC test refresh on cluster when dex, local user
      // TODO: RC test switching between clustes
      // TODO: RC auto refresh token on expirer? silent refresh?
      // this.dexUserManager.events.addSilentRenewError
      // this.manager.events.addAccessTokenExpiring(() => { console.log('token expiring'); this.manager.signinSilent({ extraTokenParams: { appId: 123, domain: 'abc.com' } }).then(user => { }).catch(e => { }); });
      // automaticSilentRenew: true,
      // silent_redirect_uri: `${window.location.origin}/assets/silent-callback.html`
      // TODO: RC document epinio setup
      // TODO: RC create issue epinio /endpoint to determine enabled auth endpoints (aka show dex) and also to get epinio version

      cluster.loggedIn = true;

      this.$router.push({
        name:   'epinio-c-cluster-dashboard',
        params: { cluster: cluster.id }
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
        @changed="tabChanged"
      >
        <Tab
          label-key="epinio.login.modal.local.tabLabel"
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
          name="dex"
          :weight="2"
          class="login-dialog__tab"
        >
          <p>
            {{ t('epinio.login.modal.dex.prompt') }}
          </p>
        </Tab>
      </Tabbed>
    </template>

    <!-- <div
      slot="actions"
      class="bottom"
    >
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
      <div class="buttons">
        <button
          class="btn role-secondary mr-10"
          @click="close"
        >
          {{ t('generic.cancel') }}
        </button>

        <AsyncButton
          :mode="'login'"
          @click="login"
        />
      </div>
    </div> -->
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
