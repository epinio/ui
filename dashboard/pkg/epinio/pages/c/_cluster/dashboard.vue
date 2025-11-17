<script setup lang="ts">
import { Location } from 'vue-router';
import { useStore } from 'vuex';
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import {
  EpinioApplicationResource,
  EpinioCatalogService,
  EPINIO_MGMT_STORE,
  EPINIO_TYPES,
} from '../../../types';

import { sortBy } from 'lodash';
import isEqual from 'lodash/isEqual';

import { METRIC } from '@shell/config/types';
import { allHash } from '@shell/utils/promise';
import Namespace from '@shell/models/namespace';
import Banner from '@components/Banner/Banner.vue';
import EpinioServiceModel from '../../../models/services';
import { parseSi, createMemoryValues } from '@shell/utils/units';
import { createEpinioRoute } from '../../../utils/custom-routing';
import { startPolling, stopPolling } from '../../../utils/polling';
import DashboardCard from '../../../components/dashboard/Cards.vue';
import ConsumptionGauge from '@shell/components/ConsumptionGauge.vue';

type ComponentService = {
  name: string,
  link: Location,
  isEnabled: boolean
}

const store = useStore();
const t = store.getters['i18n/t'];
const colorStops = {
  0: '--info',
  30: '--info',
  70: '--info',
};

//Variables that can recieve updates
const version = ref<string>('');
const showMetricsInfo = ref<boolean>(false);
const availableCpu = ref<number>(100);
const availableMemory = ref<number>(100);
const sectionContent = ref<Array>([
  {
    isEnable: true,
    isLoaded: false,
    icon: 'icon-namespace',
    cta: createEpinioRoute(
      'c-cluster-resource',
      { resource: EPINIO_TYPES.NAMESPACE },
      { query: { mode: 'openModal' }, }
    ),
    link: createEpinioRoute(
      'c-cluster-resource',
      { resource: EPINIO_TYPES.NAMESPACE },
    ),
    linkText:    t('epinio.intro.cards.namespaces.linkText'),
    description: t('typeDescription.namespaces', {}, true),
    slotTitle:   t('epinio.intro.cards.namespaces.slotTitle')
  },
  {
    isEnable: true,
    isLoaded: false,
    icon: 'icon-application',
    cta: createEpinioRoute(
      'c-cluster-applications-createapp',
      { resource: EPINIO_TYPES.APP },
    ),
    link: createEpinioRoute(
      'c-cluster-applications',
      { resource: EPINIO_TYPES.APP },
    ),
    linkText: t('epinio.intro.cards.applications.linkText'),
    description: t('typeDescription.applications'),
    slotTitle: '',
  },
  {
    isEnable: true,
    isLoaded: false,
    icon: 'icon-service',
    cta: createEpinioRoute(
      'c-cluster-resource-create',
      { resource: EPINIO_TYPES.SERVICE_INSTANCE },
    ),
    link: createEpinioRoute(
      'c-cluster-resource',
      { resource: EPINIO_TYPES.SERVICE_INSTANCE },
    ),
    linkText: t('epinio.intro.cards.services.linkText'),
    // INFO: typeDescription to long for the dashboard card.
    description: t('epinio.intro.cards.services.description'),
    slotTitle: t('epinio.intro.cards.services.slotTitle')
  },
]);

/*
* Computed Variables
*/

const aboutLink = computed(() => {
  if (!store.getters['isSingleProduct']) {
    return createEpinioRoute(
      'c-cluster-about',
      { cluster: store.getters['clusterId'] },
    );
  }

  return null;
});

const services = computed(() => {
  const fetchServicesInstances: EpinioServiceModel[] =
    store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE);
  const fetchServices: EpinioCatalogService[] =
    store.getters['epinio/all'](EPINIO_TYPES.CATALOG_SERVICE);

  // Try to find the desired services
  const findDesiredServices = fetchServices?.filter(
    (service) => service.id === 'mysql-dev' || service.id === 'redis-dev'
  );

  //  if not found, return the first two services from the catalog
  const services: EpinioCatalogService[] =
    findDesiredServices.length ? findDesiredServices : fetchServices.slice(0, 2);

  const s = services.reduce(
    (acc: ComponentService[], service: EpinioCatalogService) => {
      acc.push({
        link: createEpinioRoute(
          'c-cluster-resource-create',
          { resource: EPINIO_TYPES.SERVICE_INSTANCE, name: service.id },
          { query: { service: service.id } }
        ),
        name: service.name,
        isEnabled: true
      });

      return acc;
    },
    [] as ComponentService[]
  );

  return {
    servicesInstances: fetchServicesInstances.length,
    servicesCatalog:   s,
  };
});

const apps = computed(() => {
  const allApps = store.getters['epinio/all'](EPINIO_TYPES.APP) as EpinioApplicationResource[];

  return allApps.reduce((acc, item) => {
    return {
      runningApps: acc.runningApps + (item.status === 'running' ? 1 : 0),
      stoppedApps: acc.stoppedApps + (item.status === 'error' ? 1 : 0),
      totalApps:   acc.totalApps + 1,
    };
  }, {
    runningApps: 0, stoppedApps: 0, totalApps: 0
  });
});

const namespaces = computed(() => {
  const allNamespaces: Namespace[] = store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE);

  return {
    totalNamespaces: allNamespaces.length,
    latestNamespaces: sortBy(allNamespaces, 'metadata.createdAt').reverse().slice(0, 2),
  };
});

/*
* Watchers
*/

watch(services, (oldValue, newValue) => {
  if (isEqual(oldValue, newValue)){
    return;
  }

  generateCards();
}, { immediate: true });

watch(apps, (oldValue, newValue) => {
  if (isEqual(oldValue, newValue)){
    return;
  }

  generateCards();
}, { immediate: true });

watch(namespaces, (oldValue, newValue) => {
  if (isEqual(oldValue, newValue)) {
    return;
  }

  generateCards();
}, { immediate: true });

const metricsDetails = computed(() => {
  return {
    name:   'c-cluster-explorer',
    params: { cluster: store.getters['clusterId'] }
  };
});

onMounted(async () => {
  generateCards();
  await getVersionHash();

  startPolling(['namespaces', 'applications', 'services'], store);
});

onUnmounted(() => {
  stopPolling(['namespaces', 'applications', 'services']);
});

async function getVersionHash() {
  const hash: { [key:string]: any } = await allHash({
    ns: store.dispatch(
      `epinio/findAll`,
      { type: EPINIO_TYPES.NAMESPACE }
    ),
    svc: store.dispatch(
      `epinio/findAll`,
      { type: EPINIO_TYPES.SERVICE_INSTANCE }
    ),
    catalogSvc: store.dispatch(
      `epinio/findAll`,
      { type: EPINIO_TYPES.CATALOG_SERVICE }
    ),
    version: store.dispatch('epinio/version'),
    showMetrics: calcAvailableResources()
  });

  version.value = hash.version;
}

async function calcAvailableResources() {
  if (store.getters['isSingleProduct']) {
    return;
  }

  const nodeMetricsSchema = store.getters[`epinio/schemaFor`](METRIC.NODE);

  if (nodeMetricsSchema) {
    const id = store.getters['clusterId'];

    const nodeMetrics = await store.dispatch(
      `cluster/request`,
      { url: `/k8s/clusters/${ id }/v1/metrics.k8s.io.nodemetrics` },
      { root: true },
    );

    const currentCluster = store.getters[`${ EPINIO_MGMT_STORE }/byId`](EPINIO_TYPES.CLUSTER, id);

    const cpu = {
      total:  parseSi(currentCluster.mgmtCluster?.status?.capacity?.cpu, null),
      useful: parseSi(nodeMetrics.data[0].usage.cpu, null)
    };

    const memory = createMemoryValues(
      currentCluster.mgmtCluster?.status?.capacity?.memory,
      nodeMetrics.data[0].usage.memory,
    );

    availableCpu.value = Math.floor(100 - cpu.useful / cpu.total * 100);
    availableMemory.value = Math.floor(100 - memory.useful / memory.total * 100);

    showMetricsInfo.value = true;
  }
}

function generateCards() {
  // Handles titles
  sectionContent.value[0].title = t(
    'typeLabel.withCount.namespaces',
    { n: namespaces.value?.totalNamespaces },
  );
  sectionContent.value[1].title = t(
    'typeLabel.withCount.applications',
    { n: apps.value?.totalApps },
  );
  sectionContent.value[2].title = t(
    'typeLabel.withCount.services',
    { n: services.value?.servicesInstances },
  );

  // Handles descriptions
  if (namespaces.value.totalNamespaces >= 0) {
    sectionContent.value[0].isLoaded = true;
  }

  if (apps.value.totalApps >= 0) {
    sectionContent.value[1].isLoaded = true;
  }

  if (services.value.servicesCatalog?.length >= 0) {
    sectionContent.value[2].isLoaded = true;
    sectionContent.value[2].isEnable = true;
  }
}
</script>

<template>
  <div class="dashboard">
    <div class="head">
      <div class="head-title">
        <h1>{{ t('epinio.intro.welcome') }}</h1>
        <span v-if="version">{{ version.displayVersion }}</span>
      </div>
      <p class="head-subheader">
        {{ t('epinio.intro.blurb') }}
      </p>
      <p>
        {{ t('epinio.intro.description') }}
      </p>
      <div class="head-links">
        <a
          href="https://epinio.io/"
          target="_blank"
          rel="noopener noreferrer nofollow"
        >{{ t('epinio.intro.getStarted') }}</a>
        <a
          href="https://github.com/epinio/epinio/issues"
          target="_blank"
          rel="noopener noreferrer nofollow"
        >{{ t('epinio.intro.issues') }}</a>
        <RouterLink
          v-if="aboutLink"
          :to="aboutLink"
        >
          {{ t('epinio.intro.about') }}
        </RouterLink>
      </div>
    </div>
    <Banner
      v-if="showMetricsInfo"
      class="metrics"
      color="info"
    >
      <span>
        {{ t('epinio.intro.metrics.availability', { availableCpu, availableMemory }) }}
      </span>
      <RouterLink
        :to="metricsDetails"
      >
        {{ t('epinio.intro.metrics.link.label') }}
      </RouterLink>
    </Banner>
    <div class="get-started">
      <div
        v-for="(card, index) in sectionContent"
        :key="index"
      >
        <DashboardCard
          v-if="card.isEnable"
          :is-loaded="card.isLoaded"
          :title="card.title"
          :icon="card.icon"
          :cta="card.cta"
          :link="card.link"
          :link-text="card.linkText"
          :description="card.description"
          :slot-title="card.slotTitle"
        >
          <span v-if="index === 0 && namespaces.latestNamespaces.length > 0">
            <ul>
              <li
                v-for="(ns, i) in namespaces.latestNamespaces"
                :key="i"
              >
                {{ ns.id }}
              </li>
            </ul>
          </span>
          <span v-if="index === 1 && apps.totalApps > 0">
            <ConsumptionGauge
              :resource-name="t('epinio.intro.cards.applications.running')"
              :capacity="apps.totalApps"
              :used-as-resource-name="true"
              :color-stops="colorStops"
              :used="apps.runningApps"
              units="Apps"
            />
          </span>
          <span v-if="index === 2">
            <ul>
              <li
                v-for="(service, i) in services.servicesCatalog"
                :key="i"
              >
                <RouterLink
                  v-if="service.isEnabled"
                  :to="service.link"
                  class="link"
                >
                  {{ service.name }}
                  <span>+</span>
                </RouterLink>

                <span
                  v-if="!service.isEnabled"
                  class="link disabled"
                >
                  {{ service.name }}
                  <span>+</span>
                </span>
              </li>
            </ul>
          </span>
        </DashboardCard>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dashboard {
  display: flex;
  flex-direction: column;

  .head {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: $space-m;
    outline: 1px solid var(--border);
    border-radius: var(--border-radius);
    margin: 0 0 20px 0;
    padding: $space-m;
    gap: $space-m;

    &-title {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;

      h1 {
        margin: 0;
      }

      span {
        background: var(--primary);
        color: var(--primary-text);
        border-radius: var(--border-radius);
        padding: 4px 8px;
      }
    }

    &-subheader {
      font-size: 1.2rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    &-links {
      display: flex;
      gap: 10px;
    }
  }

  .get-started {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    grid-gap: 20px;
  }
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: $space-s;

  li, .link {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    font-size: 14px;

    &:not(:last-child) {
      border-bottom: 1px solid var(--border);
      padding-bottom: $space-s;
    }
  }

  li > .disabled {
    color: var(--disabled-text);
  }

  .disabled {
    cursor: not-allowed;
  }
}
</style>

<style lang="scss">
  .metrics {

    &.banner {
      margin-top: 0;
      margin-bottom: 20px;
    }

    .banner__content {
      .cluster-link {
        cursor: pointer;
      }
    }
  }
</style>
