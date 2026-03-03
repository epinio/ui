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
    icon: 'list',
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
    icon: 'table',
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
    icon: 'rocket',
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
          { query: { catalogservice: service.id } }
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

  // Poll only essential resources for dashboard - services catalog changes infrequently
  startPolling(['namespaces', 'applications'], store);
});

onUnmounted(() => {
  stopPolling(['namespaces', 'applications']);
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
    'typeLabel.withoutCount.namespaces'
  );
  sectionContent.value[1].title = t(
    'typeLabel.withoutCount.applications'
  );
  sectionContent.value[2].title = t(
    'typeLabel.withoutCount.services'
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

  // check local storage for hidden cards
const hideGetStarted = localStorage.getItem('hideGetStarted') === 'true';
const hideIssuesCard = localStorage.getItem('hideIssuesCard') === 'true';

function handleGetStartedClick() {
  window.open('https://epinio.io/', '_blank');
}

function handleIssuesClick() {
  window.open('https://github.com/epinio/epinio/issues', '_blank');
}

function handleCardDismiss(e: Event, cardType: string) {
  const target = e.target as HTMLElement;
  target.remove();
  if (cardType === 'getStarted') {
    localStorage.setItem('hideGetStarted', 'true');
  } else if (cardType === 'issues') {
    localStorage.setItem('hideIssuesCard', 'true');
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
      <p>
        {{ t('epinio.intro.description') }}
      </p>
      <div class="head-links">
        <trailhand-card
          v-if="!hideGetStarted"
          variant="info"
          :card-title="t('epinio.intro.getStarted')"
          :subtitle="t('epinio.intro.getStartedSubtitle')"
          icon-name="rocket"
          clickable
          dismissible
          @click="handleGetStartedClick"
          @card-dismiss="(e) => handleCardDismiss(e, 'getStarted')"
        >
        </trailhand-card>
        <trailhand-card
          v-if="!hideIssuesCard"
          variant="info"
          :card-title="t('epinio.intro.issues')"
          :subtitle="t('epinio.intro.issuesSubtitle')"
          icon-name="bug"
          clickable
          dismissible
          @click="handleIssuesClick"
          @card-dismiss="(e) => handleCardDismiss(e, 'issues')"
        >
        </trailhand-card>
        <trailhand-card
          v-if="aboutLink"
          variant="info"
          :card-title="t('epinio.intro.about')"
          :href="$router.resolve(aboutLink).href"
          icon-name="info"
        >
        </trailhand-card>
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
        <trailhand-card
          v-if="card.isEnable"
          :loading="!card.isLoaded"
          :icon-name="card.icon"
          :description="card.description"
          class="dashboard-card"
        >
          <RouterLink
              :to="card.link"
              class="head-link"
              slot="title"
          >
            {{ card.title }}
          </RouterLink>
          <trailhand-button
            variant="secondary"
            slot="action"
            size="large"
            @click="$router.push(card.cta)"
          >
            {{ card.linkText }}
          </trailhand-button>
          <span v-if="index === 0 && namespaces.latestNamespaces.length > 0" slot="footer">
            <p>New Namespaces</p>
            <ul>
              <li
                v-for="(ns, i) in namespaces.latestNamespaces"
                :key="i"
              >
                {{ ns.id }}
              </li>
            </ul>
          </span>
          <span v-if="index === 1 && apps.totalApps > 0" slot="footer">
            <trailhand-progress-bar label="Running" :value="apps.runningApps" :total="apps.totalApps"></trailhand-progress-bar>
          </span>
          <span v-if="index === 2" slot="footer">
            <p>Quick Start With</p>
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
        </trailhand-card>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
trailhand-card.dashboard-card {
  --th-card-icon-color: var(--th-color-text-secondary);
}

.head-link {
  color: var(--th-color-text-primary);
}

.dashboard {
  display: flex;
  flex-direction: column;
  padding: 32px 64px;

  .head {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    margin: 0 0 40px 0;
    gap: $space-m;

    &-title {
      display: flex;
      flex-direction: row;
      align-items: baseline;
      gap: 10px;

      h1 {
        font-size: 2rem;
        font-weight: 500;
        margin: 0;
        color: var(--th-color-text-primary);
      }

      span {
        font-size: 1.3125rem;
        font-weight: 700;
        color: var(--th-color-primary);
      }
    }

    &-subheader {
      font-size: 1.2rem;
      font-weight: 500;
      color: var(--th-color-text-secondary);
    }

    &-links {
      display: flex;
      gap: 10px;
    }

    p {
      font-size: 1rem;
      font-weight: 400;
      color: var(--th-color-text-secondary);
    }
  }

  .get-started {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    grid-gap: 20px;
  }
}

span {
  p {
    font-size: 1.2rem;
    font-weight: 500;
  }
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: $space-s;
  padding: $space-s;

  li, .link {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    font-size: 14px;
  }

  .link {
    color: var(--th-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  li > .disabled {
    color: var(--th-color-disabled-text);
  }

  .disabled {
    cursor: not-allowed;
  }
}

trailhand-button {
  width: 100%;
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
