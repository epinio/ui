<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useStore } from 'vuex';
import { MANAGEMENT } from '@shell/config/types';
import { getVendor } from '@shell/config/private-label';

const store = useStore();

const version = ref<any>(null);
const settings = ref<any[]>([]);

const t = store.getters['i18n/t'];


const fetchData = async () => {
  settings.value = await store.dispatch(`management/findAll`, { type: MANAGEMENT.SETTING });
  version.value = await store.dispatch('epinio/version');
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

</script>

<template>
  <div class="about">
    <template>
      <h1 v-t="'about.title'">
        {{ appName }}
      </h1>
      <table>
        <thead>
          <tr>
            <th>{{ t('about.versions.component') }}</th>
            <th>{{ t('about.versions.version') }}</th>
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
        {{ t('about.downloadCLI.title') }}
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
        {{ t('epinio.about.allPackages') }}
      </a>
    </template>
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
</style>
