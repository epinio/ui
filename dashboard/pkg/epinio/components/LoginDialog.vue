<script>
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import Password from '@shell/components/form/Password';
import { LabeledInput } from '@components/Form/LabeledInput';
import { Banner } from '@components/Banner';
import { stringify, exceptionToErrorsArray } from '@shell/utils/error';

const PROVIDER_TYPES = {
  LOCAL: 'local',
  DEX:   'dex',
};

export default {
  name: 'LoginDialog',

  components: {
    Banner, LabeledInput, Password
  },

  props: {
    cluster: {
      type:     Object,
      required: true
    }
  },

  data() {
    return {
      selectedTab:      '',
      username:         '',
      password:         '',
      PROVIDER_TYPES,
      selectedAuthType: null,
      errors:           [],
      stringify,
      busy:             false,
    };
  },

  mounted() {
    if (!this.cluster.oidcEnabled) {
      this.selectedAuthType = PROVIDER_TYPES.LOCAL;
    } else {
      this.selectedAuthType = PROVIDER_TYPES.DEX;
    }
  },

  methods: {
    selectType(type) {
      this.errors = [];
      this.selectedAuthType = type;
    },

    async login(provider) {
      this.busy = true;
      this.errors = [];
      const errors = [];

      try {
        switch (provider) {
        case PROVIDER_TYPES.LOCAL:

          if (!this.username) {
            errors.push('Username');
          }
          if (!this.password) {
            errors.push('Password');
          }
          if (errors.length) {
            throw new Error(`${ errors.join('/') } Required`);
          }

          await epinioAuth.login(this.cluster.createAuthConfig(EpinioAuthTypes.LOCAL, {
            username: this.username,
            password: this.password,
            $axios:   this.$axios,
          }));
          break;
        case PROVIDER_TYPES.DEX:
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
      } catch (err) {
        this.errors.push(...exceptionToErrorsArray(err));
      }

      this.busy = false;
    },

  }
};
</script>

<template>
  <div class="login-dialog">
    <div v-if="errors.length">
      <div
        v-for="(err, idx) in errors"
        :key="idx"
      >
        <Banner
          color="error"
          :label="stringify(err.Message || err)"
        />
      </div>
    </div>
    <div v-if="selectedAuthType === PROVIDER_TYPES.DEX">
      <button
        ref="btn"
        :class="{'disabled': busy}"
        class="btn bg-primary"
        style="font-size: 18px;"
        @click="!busy && login(PROVIDER_TYPES.DEX)"
      >
        {{ t('epinio.login.genericProvider') }}
      </button>
    </div>
    <div
      v-if="selectedAuthType === PROVIDER_TYPES.LOCAL"
      class="local"
    >
      <form>
        <div class="mb-20">
          <LabeledInput
            id="username"
            ref="username"
            v-model.trim="username"
            :label="t('login.username')"
            autocomplete="epinio-username"
            :required="true"
          />
        </div>
        <div class="mb-20">
          <Password
            id="password"
            ref="password"
            v-model="password"
            :label="t('login.password')"
            autocomplete="epinio-password"
            :required="true"
          />
        </div>
      </form>
      <button
        ref="btn"
        class="btn bg-primary"
        :class="{'disabled': busy}"
        style="font-size: 18px;"
        @click="!busy && login(PROVIDER_TYPES.LOCAL)"
      >
        {{ t('login.loginWithLocal') }}
      </button>
    </div>

    <div
      v-if="selectedAuthType === PROVIDER_TYPES.DEX"
      class="mt-20 text-center"
    >
      <a
        :class="{'disabled': busy}"
        role="button"
        @click="!busy && selectType(PROVIDER_TYPES.LOCAL)"
      >
        {{ t('login.useLocal') }}
      </a>
    </div>
    <div
      v-if="cluster.oidcEnabled && selectedAuthType === PROVIDER_TYPES.LOCAL"
      class="mt-20 text-center"
    >
      <a
        :class="{'disabled': busy}"
        role="button"
        @click="!busy && selectType(PROVIDER_TYPES.DEX)"
      >
        {{ t('epinio.login.useGenericProvider', {}) }}
      </a>
    </div>
  </div>
</template>
<style lang='scss' scoped>
$min-width: 400px;

.login-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  min-height: 240px;

  .banner {
    min-width: $min-width;
  }

  .local {
    display: flex;
    flex-direction: column;
    align-items: center;

    .labeled-input, .password {
      min-width: $min-width;
    }
  }
}
</style>
