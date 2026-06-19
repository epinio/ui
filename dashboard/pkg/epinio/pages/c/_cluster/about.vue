<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useStore } from 'vuex';
import { MANAGEMENT } from '@shell/config/types';
import { getVendor } from '@shell/config/private-label';
import { downloadFile } from '@shell/utils/download';
import { makeEmptyCell } from '../../../utils/table-formatters';

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

const aboutTitleString = computed(() => t('about.title'));
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
  return `${isSingleProduct ? getVendor() : t('epinio.label')} Server`;
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

const downloadLinuxImages = null;

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

// Versions table
const versionRows = computed(() => {
  if (!version.value) return [];
  return [{ name: appName.value, version: versionString.value }, { name: 'Epinio UI', version: 'v1.14.1' }];
});

const versionColumns = [
  {
    field:     'name',
    label:     t('about.versions.component'),
    formatter: (_v: any, row: any) => {
      const a = document.createElement('a');

      a.href = row.name === 'Epinio UI' ? 'https://github.com/epinio/ui' : 'https://github.com/epinio/epinio';
      a.target = '_blank';
      a.rel = 'nofollow noopener noreferrer';
      a.textContent = row.name;

      return a;
    }
  },
  {
    field: 'version',
    label: t('about.versions.version')
  }
];

// Downloads table
const downloadColumns = [
  {
    field:     'label',
    label:     t('about.versions.component'),
    formatter: (_v: any, row: any) => {
      const div = document.createElement('div');

      div.style.cssText = 'display:flex; align-items:center;';

      const icon = document.createElement('i');

      icon.className = `icon ${ row.icon } mr-5`;
      div.appendChild(icon);
      div.appendChild(document.createTextNode(t(row.label)));

      return div;
    }
  },
  {
    field:     'cliFile',
    label:     t('about.downloadCLI.title'),
    formatter: (_v: any, row: any) => {
      if (!row.cliLink) return makeEmptyCell();

      const a = document.createElement('a');

      a.href = row.cliLink;
      a.textContent = row.cliFile;

      return a;
    }
  }
];

const reportStatus = computed(() => {
  if (reportSuccess.value) return { message: reportSuccess.value, variant: 'success' };
  if (reportError.value) return { message: reportError.value, variant: 'error' };
  return null;
});

const bundleStatus = computed(() => {
  if (supportBundleSuccess.value) return { message: supportBundleSuccess.value, variant: 'success' };
  if (supportBundleError.value) return { message: supportBundleError.value, variant: 'error' };
  return null;
});
</script>

<template>
  <div class="about">
    <trailhand-tag
      v-if="fetchError"
      :label="fetchError"
      variant="error"
      size="md"
      class="mb-20"
    />

    <template v-if="version">
      <h1>
        {{ aboutTitleString }}
      </h1>
      <trailhand-table
        :rows="versionRows"
        :columns="versionColumns"
        :searchable="false"
        key-field="name"
        class="version-table"
      />
    </template>

    <template v-if="version && downloads.length">
      <h3 class="pt-40">
        {{ aboutDownloadCLIString }}
      </h3>
      <trailhand-table
        :rows="downloads"
        :columns="downloadColumns"
        :searchable="false"
        key-field="icon"
        class="downloads-table"
      />
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

    <div
      v-if="version"
      class="about-cards"
    >
      <trailhand-card
        icon-name="info"
        class="about-card"
      >
        <span slot="title">{{ t('epinio.downloadReport.title') }}</span>
        <div
slot="description"
          class="download__body"
        >
          <p class="download__description">
            {{ t('epinio.downloadReport.description') }}
          </p>
        </div>
        <trailhand-button
slot="action"
          variant="secondary"
          size="large"
          :disabled="reportLoading"
          class="download__button"
          @click="downloadReport"
        >
          {{ reportLoading ? 'Downloading...' : t('epinio.downloadReport.action') }}
        </trailhand-button>
        <span
v-if="reportStatus"
          slot="footer"
        >
          <trailhand-tag
            :label="reportStatus.message"
            :variant="reportStatus.variant"
            size="md"
          />
        </span>
      </trailhand-card>

      <trailhand-card
        icon-name="tools"
        class="about-card bundle-card"
      >
        <span slot="title">{{ t('epinio.supportBundle.title') }}</span>
        <div
slot="description"
          class="support-bundle__body"
        >
          <p class="support-bundle__description">
            {{ t('epinio.supportBundle.description') }}
          </p>
            <label class="checkbox-label">
              <trailhand-checkbox
                :checked="includeApps"
                :disabled="supportBundleLoading"
                @checkbox-change="includeApps = $event.detail.checked"
              />
              {{ t('epinio.supportBundle.includeApps') }}
            </label>
          <div class="support-bundle__controls">
            <div class="input-button-row">
              <trailhand-text-input
                :label="t('epinio.supportBundle.tail.label')"
                :value="String(tailLines)"
                size="large"
                :disabled="supportBundleLoading"
                @text-input-change="tailLines = sanitizeTail($event.detail.value)"
              />
              <trailhand-button
                variant="secondary"
                size="large"
                :disabled="supportBundleLoading"
                @click="downloadSupportBundle"
              >
                {{ supportBundleLoading ? t('epinio.supportBundle.collecting') : t('epinio.supportBundle.action') }}
              </trailhand-button>
            </div>
          </div>
        </div>
        <span
v-if="bundleStatus"
          slot="footer"
        >
          <trailhand-tag
            :label="bundleStatus.message"
            :variant="bundleStatus.variant"
            size="md"
          />
        </span>
      </trailhand-card>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.about {
  .version-table,
  .downloads-table {
    --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
    --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
    --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
  }
}

.about-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 40px;
  align-items: stretch;
}

.about-card {
  height: 100%;
}

.about-card::part(card) {
  height: 100%;
  box-sizing: border-box;
}

.bundle-card::part(action) {
  margin-bottom: 0;
}

.support-bundle__body,
.download__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

trailhand-button.download__button {
  width: 100%;
}

.support-bundle__description,
.download__description {
  margin: 0;
  font-size: 14px;
  color: var(--th-color-text-secondary);
}

.support-bundle__controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-button-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: end;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}
</style>
