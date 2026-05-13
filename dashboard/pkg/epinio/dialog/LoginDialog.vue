<script setup lang="ts">
import axios from 'axios';
import { useStore } from 'vuex';
import { ref, onMounted, watchEffect } from 'vue';

import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import { stringify, exceptionToErrorsArray } from '@shell/utils/error';
import { EpinioCluster } from '../models/cluster';

import { Banner } from '@components/Banner';

const store = useStore();

const emit = defineEmits<{
  (e: 'close'): void
}>();

const PROVIDER_TYPES = {
  LOCAL: 'local',
  DEX:   'dex',
};

const username = ref<string>('');
const password = ref<string>('');
const selectedAuthType = ref<string>('');
const busy = ref<boolean>(false);
const showModal = ref<boolean>(false);
const cluster = ref<EpinioCluster | null>(null);

let errors: Error[] = [];
let selectedTab: string;

watchEffect(() => {
  if (!cluster.value?.oidcEnabled) {
    selectedAuthType.value = PROVIDER_TYPES.LOCAL;
  } else {
    selectedAuthType.value = PROVIDER_TYPES.DEX;
  }
});

const selectType = (type: string) => {
  errors = [];
  selectedAuthType.value = type as string;
}

const login = async (provider: string) => {
  busy.value = true;
  errors = [];

  try {
    switch (provider) {
      case PROVIDER_TYPES.LOCAL:
        if (!username.value) {
          errors.push(new Error('Username'));
        }
        if (!password.value) {
          errors.push(new Error('Password'));
        }
        if (errors.length) {
          throw new Error(`${ errors.join('/') } Required`);
        }

        await epinioAuth.login(cluster.value!.createAuthConfig(
          EpinioAuthTypes.LOCAL, {
            username: username.value,
            password: password.value,
            $axios:   axios,
          }
        ));
        break;
      case PROVIDER_TYPES.DEX:
        await epinioAuth.login(cluster.value!.createAuthConfig(EpinioAuthTypes.DEX));
        break;
      default:
        throw new Error(`Unknown log in type: ${ selectedTab }`);
    }
    cluster.value!.loggedIn = true;

    //Ensure the store knows the dialog has been closed.
    emit('close');

    store.$router.push({
      name:   'epinio-c-cluster-dashboard',
      params: { cluster: cluster.value!.id }
    });
  } catch (err) {
    errors.push(...exceptionToErrorsArray(err));
  }

  busy.value = false;
}

const openLogin = (selectedCluster: EpinioCluster) => {
  showModal.value = true;
  cluster.value = selectedCluster;
}

const closeLogin = () => {
  showModal.value = false;
  cluster.value = null;
  username.value = '';
  password.value = '';
  busy.value = false;
  errors = [];
};

defineExpose({
  openLogin,
  closeLogin,
});
</script>

<template>
  <trailhand-modal v-if="!!cluster" :title="`Login ${ cluster.name ? `to ${ cluster.name }` : '' }`" :open.prop="showModal" @modal-close="closeLogin">
    <div class="modal-content" id="modal-container-element">
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
      <trailhand-button
        v-if="selectedAuthType == PROVIDER_TYPES.DEX"
        :disabled="busy"
        size="medium"
        @button-click="!busy && login(PROVIDER_TYPES.DEX)"
        @keydown.enter.prevent="!busy && login(PROVIDER_TYPES.DEX)"
      >
        {{ t('epinio.login.genericProvider') }}
      </trailhand-button>
      <div
        v-if="selectedAuthType === PROVIDER_TYPES.LOCAL"
        class="local"
      >
        <form
          class="login-form"
          @submit.prevent="!busy && login(PROVIDER_TYPES.LOCAL)"
        >
          <trailhand-text-input
            id="username"
            :value="username"
            :label="t('login.username')"
            :required="true"
            size="large"
            @text-input-change="(e: CustomEvent) => username = e.detail.value"
            style="width: 100%;"
          />
          <trailhand-text-input
            id="password"
            :value="password"
            :label="t('login.password')"
            :required="true"
            size="large"
            @text-input-change="(e: CustomEvent) => password = e.detail.value"
            style="width: 100%;"
            type="password"
          />
          <trailhand-button
            size="medium"
            :disabled="busy"
            type="submit"
            @keydown.enter.prevent="!busy && login(PROVIDER_TYPES.LOCAL)"
          >
            {{ t(cluster.oidcEnabled ? 'login.loginWithLocal' : 'epinio.login.login') }}
          </trailhand-button>
        </form>
      </div>

      <div
        v-if="selectedAuthType === PROVIDER_TYPES.DEX"
        class="mt-20 text-center"
      >
        <trailhand-button
          variant="secondary"
          size="medium"
          :disabled="busy"
          @button-click="!busy && selectType(PROVIDER_TYPES.LOCAL)"
          type="button"
          @keydown.enter.prevent="!busy && selectType(PROVIDER_TYPES.LOCAL)"
        >
          {{ t('login.useLocal') }}
        </trailhand-button>
      </div>
      <div
        v-if="cluster.oidcEnabled && selectedAuthType === PROVIDER_TYPES.LOCAL"
        class="mt-20 text-center"
      >
        <trailhand-button
          variant="secondary"
          size="small"
          :disabled="busy"
          @button-click="!busy && selectType(PROVIDER_TYPES.DEX)"
          type="button"
          @keydown.enter.prevent="!busy && selectType(PROVIDER_TYPES.DEX)"
        >
          {{ t('epinio.login.useGenericProvider', {}) }}
        </trailhand-button>
      </div>
    </div>
  </trailhand-modal>
</template>
<style lang='scss' scoped>
$min-width: 400px;
.modal-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 240px;

  .login-form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 100%;
  }

  .banner {
    min-width: $min-width;
  }

  .local {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;

    .labeled-input, .password {
      min-width: $min-width;
    }
  }
}
</style>
