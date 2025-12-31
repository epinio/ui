<script setup lang="ts">
import axios from 'axios';
import { useStore } from 'vuex';
import { ref } from 'vue';

import { stringify, exceptionToErrorsArray } from '@shell/utils/error';
import { EpinioCluster } from '../models/cluster';

import { Banner } from '@components/Banner';
import { LabeledInput } from '@components/Form/LabeledInput';
import AsyncButton from '@shell/components/AsyncButton.vue';

const store = useStore();
const t = store.getters['i18n/t'];

const emit = defineEmits<{
  (e: 'close'): void
}>();

const props = defineProps<{
  cluster: EpinioCluster,
}>()

const domain = ref<string>('');
const skipCertManager = ref<boolean>(false);
const skipIngress = ref<boolean>(false);
const busy = ref<boolean>(false);
const errors = ref<Error[]>([]);
const success = ref<boolean>(false);

const install = async (buttonCb: (success: boolean) => void) => {
  busy.value = true;
  errors.value = [];

  if (!domain.value) {
    errors.value.push(new Error(t('epinio.instances.install.domainRequired')));
    busy.value = false;
    buttonCb(false);
    return;
  }

  try {
    // Call backend API to install Epinio
    const response = await axios.post('/epinio/api/v1/install', {
      domain: domain.value,
      skipCertManager: skipCertManager.value,
      skipIngress: skipIngress.value,
      clusterId: props.cluster.id
    });

    if (response.data.success) {
      success.value = true;
      // Refresh cluster list after a delay
      setTimeout(() => {
        emit('close');
        // Trigger page refresh or cluster rediscovery
        window.location.reload();
      }, 2000);
      buttonCb(true);
    } else {
      throw new Error(response.data.error || 'Installation failed');
    }
  } catch (err: any) {
    errors.value.push(...exceptionToErrorsArray(err));
    buttonCb(false);
  } finally {
    busy.value = false;
  }
}

const cancel = () => {
  emit('close');
}
</script>

<template>
  <div class="install-dialog">
    <div v-if="errors.length" class="mb-20">
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="stringify(err)"
      />
    </div>

    <div v-if="success" class="mb-20">
      <Banner
        color="success"
        :label="t('epinio.instances.install.success')"
      />
    </div>

    <div class="dialog-content">
      <h3 class="mb-20">
        {{ t('epinio.instances.install.title') }}
      </h3>
      <p class="mb-20">
        {{ t('epinio.instances.install.description') }}
      </p>

      <div class="form-group mb-20">
        <LabeledInput
          v-model="domain"
          :label="t('epinio.instances.install.domainLabel')"
          :placeholder="t('epinio.instances.install.domainPlaceholder')"
          required
        />
      </div>

      <div class="form-group mb-20">
        <label class="checkbox-label">
          <input
            v-model="skipCertManager"
            type="checkbox"
          />
          <span>{{ t('epinio.instances.install.skipCertManager') }}</span>
        </label>
      </div>

      <div class="form-group mb-20">
        <label class="checkbox-label">
          <input
            v-model="skipIngress"
            type="checkbox"
          />
          <span>{{ t('epinio.instances.install.skipIngress') }}</span>
        </label>
      </div>

      <div class="dialog-actions">
        <button
          class="btn btn-secondary"
          @click="cancel"
        >
          {{ t('epinio.instances.install.cancelButton') }}
        </button>
        <AsyncButton
          mode="install"
          :action-label="t('epinio.instances.install.installButton')"
          :waiting-label="t('epinio.instances.install.installing')"
          :success-label="t('epinio.instances.install.success')"
          @click="install"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.install-dialog {
  padding: 20px;
  min-width: 500px;
}

.dialog-content {
  h3 {
    margin-bottom: 10px;
  }

  p {
    margin-bottom: 20px;
    color: var(--input-label);
  }
}

.form-group {
  margin-bottom: 20px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  input[type="checkbox"] {
    cursor: pointer;
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
}

.mb-20 {
  margin-bottom: 20px;
}
</style>

