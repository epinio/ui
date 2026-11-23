<script setup lang="ts">
import { useStore } from 'vuex';
import { App } from '../../models/application/ui-types';

const props = defineProps<{
    app: App
}>();
const store = useStore();
const t = store.getters['i18n/t'];
const appError = props.app.failureReason;
const stagingError = props.app.stagingFailureReason;

</script>

<template>
  <div v-if="appError || stagingError" class="errors">
    <trailhand-banner
      v-if="appError"
      variant="error"
      :title="t('epinio.applications.detail.errors.pod.title')"
      :description="t('epinio.applications.detail.errors.pod.text')"
    ></trailhand-banner>
    <trailhand-banner
      v-if="stagingError"
      variant="error"
      :title="t('epinio.applications.detail.errors.staging.title')"
      :description="stagingError"
    ></trailhand-banner>
  </div>
  
</template>

<style lang="scss" scoped>
.errors {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
}
</style>