<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import Banner from '@components/Banner/Banner.vue';

const store = useStore() as any;
const t = store.getters['i18n/t'];

const showModal = ref(false);
const configToDelete = ref<any>(null);
const deleting = ref(false);
const errors = ref<string[]>([]);

const boundApps = computed(() => configToDelete.value?.configuration?.boundapps || []);

function openDelete(row: any) {
  configToDelete.value = row;
  errors.value = [];
  showModal.value = true;
}

function closeDelete() {
  showModal.value = false;
  errors.value = [];
  configToDelete.value = null;
}

async function onSubmitDelete() {
  if (!configToDelete.value) return;

  deleting.value = true;
  errors.value = [];

  try {
    const cfg = configToDelete.value;
    const configName = cfg.meta?.name;
    const namespace = cfg.meta?.namespace;

    // Unbind all bound apps before deleting
    if (boundApps.value.length) {
      const nsApps = store.getters['epinio/all'](EPINIO_TYPES.APP)
        .filter((a: any) => a.meta.namespace === namespace);

      await Promise.all(
        nsApps
          .filter((a: any) => boundApps.value.includes(a.metadata.name))
          .map((a: any) => a.unbindConfiguration([configName]))
      );
    }

    await cfg.remove();
    closeDelete();
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION, opt: { force: true } });
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP, opt: { force: true } });
  } catch (e: any) {
    errors.value = epinioExceptionToErrorsArray(e);
  } finally {
    deleting.value = false;
  }
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
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
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
        :disabled="deleting"
        @button-click="onSubmitDelete"
      >
        {{ deleting ? 'Deleting...' : t('generic.delete') }}
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
