<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { downloadSupportBundle, SupportBundleOptions, SupportBundleError, SupportBundleErrorCode } from '../../../utils/support-bundle';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import Banner from '@components/Banner/Banner.vue';

const store = useStore();
const t = store.getters['i18n/t'];

// Reactive state
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref(false);
const filename = ref<string | null>(null);
const showOptions = ref(false);
let successTimeout: ReturnType<typeof setTimeout> | null = null;

const options = ref<SupportBundleOptions>({
  includeAppLogs: false,
  tail: 1000
});

// Computed
const tailError = computed(() => {
  const tail = options.value.tail || 1000;
  // Validate that tail is a number and within range
  if (typeof tail !== 'number' || isNaN(tail)) {
    return t('epinio.supportBundle.tailError');
  }
  if (tail < 1 || tail > 10000) {
    return t('epinio.supportBundle.tailError');
  }
  return null;
});

const hasErrors = computed(() => !!tailError.value);

const canDownload = computed(() => !loading.value && !hasErrors.value);

// Methods
async function handleDownload() {
  // Validate
  if (hasErrors.value) {
    error.value = tailError.value || '';
    return;
  }

  loading.value = true;
  error.value = null;
  success.value = false;
  filename.value = null;

  try {
    const result = await downloadSupportBundle(store, options.value);

    success.value = true;
    filename.value = result.filename;
    
    // Show success notification
    store.dispatch('growl/success', {
      title: t('epinio.supportBundle.downloadStarted'),
      timeout: 5000
    }, { root: true });

    // Clear success message after 5 seconds
    if (successTimeout) {
      clearTimeout(successTimeout);
    }
    successTimeout = setTimeout(() => {
      success.value = false;
      successTimeout = null;
    }, 5000);
  } catch (err: any) {
    let errorMessage: string;
    
    // Handle SupportBundleError with translation
    if (err instanceof SupportBundleError) {
      const errorKey = `epinio.supportBundle.errors.${err.code}`;
      const translated = t(errorKey);
      // If translation exists (not the key itself), use it; otherwise use the error message
      errorMessage = translated !== errorKey ? translated : err.message;
    } else {
      errorMessage = err.message || t('epinio.supportBundle.downloadError');
    }
    
    error.value = errorMessage;
    
    // Show error notification
    store.dispatch('growl/error', {
      title: errorMessage,
      timeout: 5000
    }, { root: true });
  } finally {
    loading.value = false;
  }
}

function toggleOptions() {
  showOptions.value = !showOptions.value;
}

// Cleanup on unmount
onUnmounted(() => {
  if (successTimeout) {
    clearTimeout(successTimeout);
    successTimeout = null;
  }
});
</script>

<template>
  <div class="support-bundle">
    <h1>{{ t('epinio.supportBundle.title') }}</h1>
    
    <Banner
      color="info"
      class="mb-20"
    >
      <template #default>
        <div v-html="t('epinio.supportBundle.description')" />
      </template>
    </Banner>

    <Banner
      v-if="error"
      color="error"
      class="mb-20"
    >
      <template #default>
        {{ error }}
      </template>
    </Banner>

    <Banner
      v-if="success"
      color="success"
      class="mb-20"
    >
      <template #default>
        {{ t('epinio.supportBundle.downloadSuccess', { filename }) }}
      </template>
    </Banner>

    <!-- Progress Indicator -->
    <Banner
      v-if="loading"
      color="info"
      class="mb-20"
    >
      <template #default>
        <div class="progress-message">
          <i class="icon icon-spinner icon-spin mr-5" />
          <span>{{ t('epinio.supportBundle.generating') }}</span>
          <div class="progress-details mt-5">
            {{ t('epinio.supportBundle.progressDetails') }}
          </div>
        </div>
      </template>
    </Banner>

    <!-- Options Panel -->
    <div
      v-if="showOptions"
      class="options-panel mb-20"
    >
      <Banner
        v-if="options.includeAppLogs"
        color="warning"
        class="mb-20"
      >
        <template #default>
          {{ t('epinio.supportBundle.largeBundleWarning') }}
        </template>
      </Banner>

      <div class="form-group mb-20">
        <Checkbox
          :value="options.includeAppLogs"
          :label="t('epinio.supportBundle.includeAppLogs')"
          :disabled="loading"
          @input="options.includeAppLogs = $event"
        />
        <div class="text-muted mt-5">
          {{ t('epinio.supportBundle.includeAppLogsTooltip') }}
        </div>
      </div>

      <div class="form-group">
        <LabeledInput
          v-model.number="options.tail"
          :label="t('epinio.supportBundle.tailLines')"
          type="number"
          :min="1"
          :max="10000"
          step="1"
          :disabled="loading"
        />
        <div class="text-muted mt-5">
          {{ t('epinio.supportBundle.tailLinesTooltip') }}
        </div>
        <div
          v-if="tailError"
          class="error mt-5"
        >
          {{ tailError }}
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="actions">
      <button
        class="btn bg-primary"
        :disabled="!canDownload || loading"
        @click="handleDownload"
      >
        <i
          v-if="loading"
          class="icon icon-spinner animate-spin"
        />
        {{ loading ? t('epinio.supportBundle.generating') : t('epinio.supportBundle.downloadButton') }}
      </button>

      <button
        class="btn role-secondary ml-10"
        :disabled="loading"
        @click="toggleOptions"
      >
        {{ showOptions ? t('epinio.supportBundle.hideOptions') : t('epinio.supportBundle.showOptions') }}
      </button>
    </div>

    <!-- Info Section -->
    <div class="info-section mt-40">
      <h3>{{ t('epinio.supportBundle.whatsIncluded') }}</h3>
      <ul>
        <li>{{ t('epinio.supportBundle.includes.serverLogs') }}</li>
        <li>{{ t('epinio.supportBundle.includes.uiLogs') }}</li>
        <li>{{ t('epinio.supportBundle.includes.stagingLogs') }}</li>
        <li>{{ t('epinio.supportBundle.includes.minioLogs') }}</li>
        <li>{{ t('epinio.supportBundle.includes.registryLogs') }}</li>
        <li
          v-if="options.includeAppLogs"
        >
          {{ t('epinio.supportBundle.includes.appLogs') }}
        </li>
      </ul>

      <Banner
        color="warning"
        class="mt-20"
      >
        <template #default>
          {{ t('epinio.supportBundle.warning') }}
        </template>
      </Banner>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.support-bundle {
  padding: 20px;

  h1 {
    margin-bottom: 20px;
  }

  .options-panel {
    background: var(--sortable-table-top-divider);
    padding: 20px;
    border-radius: var(--border-radius);
    border: 1px solid var(--border);
  }

  .form-group {
    margin-bottom: 15px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .text-muted {
    color: var(--input-label);
    font-size: 0.875rem;
  }

  .error {
    color: var(--error);
    font-size: 0.875rem;
  }

  .actions {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }

  .info-section {
    h3 {
      margin-bottom: 10px;
    }

    ul {
      margin-left: 20px;
      margin-bottom: 20px;

      li {
        margin-bottom: 5px;
      }
    }
  }

  .progress-message {
    display: flex;
    align-items: center;
    flex-wrap: wrap;

    .icon-spinner {
      margin-right: 8px;
    }

    .progress-details {
      width: 100%;
      font-size: 0.875rem;
      opacity: 0.9;
      margin-top: 8px;
      padding-left: 24px;
    }
  }
}
</style>

