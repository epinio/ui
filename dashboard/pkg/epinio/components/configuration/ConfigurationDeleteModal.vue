<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { useStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import { useDeleteConfiguration, useUnbindConfiguration } from '../../queries/useConfigurationMutations';
import { ConfigurationResponse } from '../../models/configuration/ui-types';

const store = useStore() as any;
const t = store.getters['i18n/t'];

const showModal = ref(false);
const configToDelete = ref<ConfigurationResponse | null>(null);

const boundApps = computed(() => configToDelete.value?.configuration?.boundApps || []);

const {mutate: deleteConfiguration, isPending: isDeletingConfiguration, isError: deleteConfigurationError, error: deleteConfigurationErrorData} = useDeleteConfiguration(store, handleSuccess);
const {mutateAsync: unbindConfiguration, isPending: isUnbindingConfiguration, isError: unbindConfigurationError, error: unbindConfigurationErrorData} = useUnbindConfiguration(store);

function openDelete(row: ConfigurationResponse) {
  configToDelete.value = row;
  showModal.value = true;
}

function closeDelete() {
  showModal.value = false;
  configToDelete.value = null;
}

async function onSubmitDelete() {
  if (!configToDelete.value) {
        return;
    }
    if (configToDelete.value.configuration.boundApps?.length) {
        Promise.all([...configToDelete.value.configuration.boundApps.map(appName => unbindConfiguration({ namespace: configToDelete.value!.meta.namespace, appName: appName, configName: configToDelete.value!.meta.name }))])
            .then(() => {
                deleteConfiguration({ namespace: configToDelete.value!.meta.namespace, configurationName: configToDelete.value!.meta.name });
            })
            .catch((error) => {
                store.dispatch('growl/error', {
                    title: t('epinio.services.errors.unbind.error.title'),
                    message: error?.message || t('epinio.services.errors.unbind.error.message'),
                });
            });
    } else {
        deleteConfiguration({ namespace: configToDelete.value.meta.namespace, configurationName: configToDelete.value.meta.name });
    }
}

function handleSuccess() {
  store.dispatch('growl/success', {
    title:   t('epinio.growl.configuration.delete.success.title'),
    message: t('epinio.growl.configuration.delete.success.message', { name: configToDelete.value?.meta.name }),
  });
  closeDelete();
}

defineExpose({ openDelete });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    title="Are you sure?"
    @modal-close="closeDelete"
  >
    <div class="modal-content">
      <p>You are attempting to delete the configuration <strong>{{ configToDelete?.meta?.name }}</strong>.</p>
      <div v-if="boundApps.length">
        <p><strong>Caution: </strong>The following applications are bound to this configuration. Proceeding will unbind them prior to deletion.</p>
        <ul>
          <li
            v-for="app in boundApps"
            :key="app"
          >
            {{ app }}
          </li>
        </ul>
      </div>
      <p v-else>
        No applications are bound to this configuration.
      </p>
      <Banner
        v-if="unbindConfigurationError"
        color="error"
        :label="unbindConfigurationErrorData?.message || t('epinio.configurations.errors.unbind')"
      />
      <Banner
        v-if="deleteConfigurationError"
        color="error"
        :label="deleteConfigurationErrorData?.message || t('epinio.configurations.errors.delete')"
      />
    </div>

    <div slot="footer">
      <trailhand-button
        variant="secondary"
        class="mr-10"
        @button-click="closeDelete"
      >
        Cancel
      </trailhand-button>
      <trailhand-button
        variant="destructive"
        :disabled="isDeletingConfiguration || isUnbindingConfiguration"
        @button-click="onSubmitDelete"
      >
        {{ isDeletingConfiguration || isUnbindingConfiguration ? t('generic.deleting') : t('generic.delete') }}
      </trailhand-button>
    </div>
  </trailhand-modal>
</template>

<style lang="scss" scoped>
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 500px;
}
</style>
