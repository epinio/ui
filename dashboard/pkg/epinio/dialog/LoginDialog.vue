<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';

import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import { stringify, exceptionToErrorsArray } from '@shell/utils/error';
import { EpinioCluster } from '../models/cluster';

import { Banner } from '@components/Banner';
import Password from '@shell/components/form/Password';
import { LabeledInput } from '@components/Form/LabeledInput';

const router = useRouter();

const props = defineProps<{
  cluster: EpinioCluster,
}>()

const PROVIDER_TYPES = {
  LOCAL: 'local',
  DEX:   'dex',
};

const username = ref<string>('');
const password = ref<string>('');
const selectedAuthType = ref<string>('');
const busy = ref<boolean>(false);

let errors: Error[] = [];
let selectedTab: string;

onMounted(() => {
  if (!props.cluster.oidcEnabled) {
    selectedAuthType.value = PROVIDER_TYPES.LOCAL;
  } else {
    selectedAuthType.value = PROVIDER_TYPES.DEX;
  }
})

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
          errors.push('Username');
        }
        if (!password.value) {
          errors.push('Password');
        }
        if (errors.length) {
          throw new Error(`${ errors.join('/') } Required`);
        }

        await epinioAuth.login(props.cluster.createAuthConfig(
          EpinioAuthTypes.LOCAL, {
            username: username.value,
            password: password.value,
            $axios:   axios,
          }
        ));
        break;
      case PROVIDER_TYPES.DEX:
        await epinioAuth.login(props.cluster.createAuthConfig(EpinioAuthTypes.DEX));
        break;
      default:
        throw new Error(`Unknown log in type: ${ selectedTab }`);
    }
    props.cluster.loggedIn = true;

    router.push({
      name:   'epinio-c-cluster-dashboard',
      params: { cluster: props.cluster.id }
    });
  } catch (err) {
    errors.push(...exceptionToErrorsArray(err));
  }

  busy.value = false;
}
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
    <div v-if="selectedAuthType == PROVIDER_TYPES.DEX">
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
            v-model:value="username"
            :label="t('login.username')"
            :required="true"
          />
        </div>
        <div class="mb-20">
          <Password
            id="password"
            v-model:value="password"
            :label="t('login.password')"
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
        {{ t(cluster.oidcEnabled ? 'login.loginWithLocal' : 'epinio.login.login') }}
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
  padding: 20px;
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
