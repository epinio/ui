<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import { MANAGEMENT } from '@shell/config/types';
import { getVendor } from '@shell/config/private-label';
import { downloadFile } from '@shell/utils/download';

const store = useStore();

const version = ref<any>(null);
const settings = ref<any[]>([]);
const fetchError = ref<string>('');
const tailLines = ref<number>(1000);
const includeApps = ref<boolean>(false);
const supportBundleLoading = ref(false);
const supportBundleError = ref('');
const supportBundleSuccess = ref('');

const reportLoading = ref(false);
const reportError = ref('');
const reportSuccess = ref('');

const t = store.getters['i18n/t'];

const aboutVersionsComponentString = computed(() => t('about.versions.component'));
const aboutTitleString = computed(() => t('about.title'));
const aboutVersionsVersionString = computed(() => t('about.versions.version'));
const aboutDownloadCLIString = computed(() => t('about.downloadCLI.title'));
const allPackagesString = computed(() => t('epinio.about.allPackages'));


const fetchData = async() => {
  fetchError.value = '';

  try {
    settings.value = await store.dispatch(`management/findAll`, { type: MANAGEMENT.SETTING });
  } catch (err: any) {
    console.warn('Failed to load settings on About page', err);
  }

  try {
    version.value = await store.dispatch('epinio/version');
  } catch (err: any) {
    console.warn('Failed to load version on About page', err);
    fetchError.value = t('epinio.supportBundle.errors.failed');
  }
};

onMounted(fetchData);

const appName = computed(() => {
  const isSingleProduct = !!store.getters['isSingleProduct'];
  return isSingleProduct ? getVendor() : t('epinio.label');
});

function createOSOption(label: string, icon: string, cliLink: string, imageList: any = null) {
  const slash = cliLink?.lastIndexOf('/');
  return {
    label,
    icon,
    imageList,
    cliLink,
    cliFile: slash >= 0 ? cliLink.substr(slash + 1) : cliLink
  };
}

const downloads = computed(() => {
  if (!version.value) {
    return [];
  }

  const gitUrl = `https://github.com/epinio/epinio/releases/download`;
  const versionStr = version.value.displayVersion;
  const app = appName.value.toLowerCase();

  return [
    createOSOption('about.os.mac', 'icon-apple', `${gitUrl}/${versionStr}/${app}-darwin-x86_64`),
    createOSOption('about.os.linux', 'icon-linux', `${gitUrl}/${versionStr}/${app}-linux-x86_64`, downloadLinuxImages),
    createOSOption('about.os.windows', 'icon-windows', `${gitUrl}/${versionStr}/${app}-windows-x86_64.zip`)
  ];
});

const downloadLinuxImages = null;

const versionString = computed(() => {
  if (!version.value) return '';
  if (version.value.displayVersion === version.value.fullVersion) {
    return version.value.displayVersion;
  }
  return version.value.fullVersion;
});

const sanitizeTail = (value: number | string) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 1000;
  }

  return Math.max(1, Math.min(Math.round(parsed), 10000));
};

const bundleFileName = () => {
  const now = new Date();
  const pad = (val: number) => val.toString().padStart(2, '0');

  return `epinio-support-bundle-${ now.getFullYear() }-${ pad(now.getMonth() + 1) }-${ pad(now.getDate()) }-${ pad(now.getHours()) }-${ pad(now.getMinutes()) }-${ pad(now.getSeconds()) }.tar.gz`;
};

const reportFileName = () => {
  const now = new Date();
  const pad = (val: number) => val.toString().padStart(2, '0');

  return `epinio-report-${ now.getFullYear() }-${ pad(now.getMonth() + 1) }-${ pad(now.getDate()) }-${ pad(now.getHours()) }-${ pad(now.getMinutes()) }-${ pad(now.getSeconds()) }.txt`;
};

const downloadReport = async() => {
  reportError.value = '';
  reportSuccess.value = '';
  reportLoading.value = true;

  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url:          '/api/v1/report/nodes',
        method:       'get',
        params:       { format: 'text' },
        responseType: 'blob',
        timeout:      60000
      }
    });

    const blob = res?.data;
    const contentType = res?.headers?.['content-type'] || 'text/plain; charset=utf-8';

    await downloadFile(reportFileName(), blob, contentType);

    reportSuccess.value = t('epinio.downloadReport.success');
  } catch (err: any) {
    const status = err?._status || err?.status || err?.response?.status;

    reportError.value = status === 403
      ? t('epinio.downloadReport.errors.unauthorized')
      : t('epinio.downloadReport.errors.failed');
  } finally {
    reportLoading.value = false;
  }
};

const downloadSupportBundle = async() => {
  const safeTail = sanitizeTail(tailLines.value);

  tailLines.value = safeTail;
  supportBundleError.value = '';
  supportBundleSuccess.value = '';
  supportBundleLoading.value = true;

  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url:          '/api/v1/support-bundle',
        method:       'get',
        params:       { tail: safeTail, include_apps: includeApps.value },
        responseType: 'blob',
        timeout:      600000
      }
    });

    const blob = res?.data;
    const contentType = res?.headers?.['content-type'] || 'application/gzip';

    await downloadFile(bundleFileName(), blob, contentType);

    supportBundleSuccess.value = t('epinio.supportBundle.success');
  } catch (err: any) {
    const status = err?._status || err?.status || err?.response?.status;

    supportBundleError.value = status === 403
      ? t('epinio.supportBundle.errors.unauthorized')
      : t('epinio.supportBundle.errors.failed');
  } finally {
    supportBundleLoading.value = false;
  }
};

</script>

<template>
  <div class="about">
    <Banner
      v-if="fetchError"
      color="error"
      :label="fetchError"
      class="mb-20"
    />
    <template v-if="version">
      <h1>
        {{ aboutTitleString }}
      </h1>
      <table>
        <thead>
          <tr>
            <th>{{ aboutVersionsComponentString }}</th>
            <th>{{ aboutVersionsVersionString }}</th>
          </tr>
        </thead>
        <tr v-if="version">
          <td>
            <a
              href="https://github.com/epinio/epinio"
              target="_blank"
              rel="nofollow noopener noreferrer"
            >
              {{ appName }}
            </a>
          </td>
          <td>{{ versionString }}</td>
        </tr>
      </table>
    </template>

    <template v-if="version && downloads.length">
      <h3 class="pt-40">
        {{ aboutDownloadCLIString }}
      </h3>
      <table>
        <tr
          v-for="d in downloads"
          :key="d.icon"
          class="link"
        >
          <td>
            <div class="os">
              <i :class="`icon ${d.icon} mr-5`" /> {{ t(d.label) }}
            </div>
          </td>
          <td>
            <a
              v-if="d.cliLink"
              :href="d.cliLink"
            >{{ d.cliFile }}</a>
          </td>
        </tr>
      </table>
    </template>

    <template v-if="version">
      <a
        class="mt-5"
        target="_blank"
        :href="`https://github.com/epinio/epinio/releases/tag/${version.displayVersion}`"
      >
        {{ allPackagesString }}
      </a>
    </template>

    <section
      v-if="version"
      class="download-report"
    >
      <h3>{{ t('epinio.downloadReport.title') }}</h3>

      <div class="download-report__actions">
        <button
          class="btn role-primary"
          :disabled="reportLoading"
          @click="downloadReport"
        >
          <i
            v-if="reportLoading"
            class="icon-spinner animate-spin mr-5"
          />
          {{ t('epinio.downloadReport.action') }}
        </button>
      </div>

      <Banner
        v-if="reportSuccess"
        color="success"
        :label="reportSuccess"
      />
      <Banner
        v-if="reportError"
        color="error"
        :label="reportError"
      />
    </section>

    <section
      v-if="version"
      class="support-bundle"
    >
      <h3>{{ t('epinio.supportBundle.title') }}</h3>
      <p class="text-muted">
        {{ t('epinio.supportBundle.description') }}
      </p>

      <div class="support-bundle__controls">
        <LabeledInput
          v-model:value="tailLines"
          type="number"
          :label="t('epinio.supportBundle.tail.label')"
          :tooltip="t('epinio.supportBundle.tail.help')"
          :min="1"
          :max="10000"
          :disabled="supportBundleLoading"
        />
        <Checkbox
          v-model:value="includeApps"
          :label="t('epinio.supportBundle.includeApps')"
          :disabled="supportBundleLoading"
        />
      </div>

      <div class="support-bundle__actions">
        <button
          class="btn role-primary"
          :disabled="supportBundleLoading"
          @click="downloadSupportBundle"
        >
          <i
            v-if="supportBundleLoading"
            class="icon-spinner animate-spin mr-5"
          />
          {{ t('epinio.supportBundle.action') }}
        </button>
        <span
          v-if="supportBundleLoading"
          class="support-bundle__progress"
        >
          {{ t('epinio.supportBundle.collecting') }}
        </span>
      </div>

      <Banner
        v-if="supportBundleSuccess"
        color="success"
        :label="supportBundleSuccess"
      />
      <Banner
        v-if="supportBundleError"
        color="error"
        :label="supportBundleError"
      />
    </section>
  </div>
</template>

<style lang="scss" scoped>
.about {
  table {
    border-collapse: collapse;
    overflow: hidden;
    border-radius: var(--border-radius);

    tr > td:first-of-type {
      width: 20%;
    }

    th, td {
      border: 1px solid var(--border);
      padding: 8px 5px;
      min-width: 150px;
      text-align: left;
    }

    th {
      background-color: var(--sortable-table-top-divider);
      border-bottom: 1px solid var(--sortable-table-top-divider);
    }

    a {
      cursor: pointer;
    }

    .os {
      display: flex;
      align-items: center;
    }
  }
}

.download-report {
  margin-top: 40px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  background: var(--default);

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
  }

  .banner {
    margin-top: 10px;
  }
}

.support-bundle {
  margin-top: 40px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  background: var(--default);

  &__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
  }

  &__progress {
    color: var(--muted);
  }

  .banner {
    margin-top: 10px;
  }
}
</style>
