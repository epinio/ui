<script lang="ts">
import { defineComponent } from 'vue';
import DashboardCard from '../../../components/dashboard/Cards.vue';
import { createEpinioRoute } from '../../../utils/custom-routing';
import { useStore } from 'vuex';

import { EpinioApplicationResource, EpinioCatalogService, EPINIO_MGMT_STORE, EPINIO_TYPES } from '../../../types';
import ConsumptionGauge from '@shell/components/ConsumptionGauge.vue';
import Namespace from '@shell/models/namespace';
import { parseSi, createMemoryValues } from '@shell/utils/units';
import EpinioServiceModel from '../../../models/services';
import isEqual from 'lodash/isEqual';
import { sortBy } from 'lodash';
import Banner from '@components/Banner/Banner.vue';
import { METRIC } from '@shell/config/types';
import { allHash } from '@shell/utils/promise';

type ComponentService = {
  name: string,
  // link: Location,
  link: any,
  isEnabled: boolean
}

export default defineComponent({
  
  async fetch() {
    const hash: { [key:string]: any } = await allHash({
      ns:          this.$store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.NAMESPACE }),
      svc:         this.$store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE }),
      catalogSvc:  this.$store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.CATALOG_SERVICE }),
      version:     this.$store.dispatch('epinio/version'),
      showMetrics: this.calcAvailableResources()
    });

    this.version = hash.version;
  },
  data() {
    const store = useStore()

    return {
      sectionContent: [
        {
          isEnable:    true,
          isLoaded:    false,
          icon:        'icon-namespace',
          cta:         createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.NAMESPACE }, { query: { mode: 'openModal' } }),
          link:        createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.NAMESPACE }),
          linkText:    this.t('epinio.intro.cards.namespaces.linkText'),
          description: this.t('typeDescription.namespaces', {}, true),
          slotTitle:   this.t('epinio.intro.cards.namespaces.slotTitle')
        },
        {
          isEnable:    true,
          isLoaded:    false,
          icon:        'icon-application',
          cta:         createEpinioRoute('c-cluster-applications-createapp', { resource: EPINIO_TYPES.APP }),
          link:        createEpinioRoute('c-cluster-applications', { resource: EPINIO_TYPES.APP }),
          linkText:    this.t('epinio.intro.cards.applications.linkText'),
          description: this.t('typeDescription.applications'),
          slotTitle:   '',
        },
        {
          isEnable:    true,
          isLoaded:    false,
          icon:        'icon-service',
          cta:         createEpinioRoute('c-cluster-resource-create', { resource: EPINIO_TYPES.SERVICE_INSTANCE }),
          link:        createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.SERVICE_INSTANCE }),
          linkText:    this.t('epinio.intro.cards.services.linkText'),
          description: this.t('epinio.intro.cards.services.description'), // INFO: typeDescription to long for the dashboard card.
          slotTitle:   this.t('epinio.intro.cards.services.slotTitle')
        }],
      colorStops: {
        0: '--info', 30: '--info', 70: '--info'
      },
      version:         null,
      aboutLink:       !store.getters['isSingleProduct'] ? createEpinioRoute('c-cluster-about', { cluster: store.getters['clusterId'] }) : null,
      availableCpu:    100,
      availableMemory: 100,
      showMetricsInfo: false
    };
  },
  created() {
    this.redoCards();
  },
  watch: {
    namespaces(old: any, neu: any) {
      if (isEqual(old, neu)) {
        return;
      }

      this.redoCards();
    },
    apps(old: any, neu: any) {
      if (isEqual(old, neu)) {
        return;
      }

      this.redoCards();
    },
    services(old: any, neu: any) {
      if (isEqual(old, neu)) {
        return;
      }

      this.redoCards();
    }
  },
  methods: {
    async calcAvailableResources() {
      const store = useStore()  


      if (store.getters['isSingleProduct']) {
        return;
      }


      const nodeMetricsSchema = store.getters[`epinio/schemaFor`](METRIC.NODE);

      if (nodeMetricsSchema) {
        const id = store.getters['clusterId'];

        const nodeMetrics = await store.dispatch(`cluster/request`, { url: `/k8s/clusters/${ id }/v1/metrics.k8s.io.nodemetrics` }, { root: true });

        const currentCluster = store.getters[`${ EPINIO_MGMT_STORE }/byId`](EPINIO_TYPES.CLUSTER, id);

        const cpu = {
          total:  parseSi(currentCluster.mgmtCluster?.status?.capacity?.cpu, null),
          useful: parseSi(nodeMetrics.data[0].usage.cpu, null)
        };

        const memory = createMemoryValues(currentCluster.mgmtCluster?.status?.capacity?.memory, nodeMetrics.data[0].usage.memory);

        this.availableCpu = Math.floor(100 - cpu.useful / cpu.total * 100);
        this.availableMemory = Math.floor(100 - memory.useful / memory.total * 100);

        this.showMetricsInfo = true;
      }
    },

    redoCards() {
      // Handles titles
      this.sectionContent[0].title = this.t('typeLabel.withCount.namespaces', { n: this.namespaces.totalNamespaces });
      this.sectionContent[1].title = this.t('typeLabel.withCount.applications', { n: this.apps?.totalApps });
      this.sectionContent[2].title = this.t('typeLabel.withCount.services', { n: this.services?.servicesInstances });

      // Handles descriptions
      if (this.namespaces?.totalNamespaces >= 0) {
        this.sectionContent[0].isLoaded = true;
      }

      if (this.apps?.totalApps >= 0) {
        this.sectionContent[1].isLoaded = true;
      }

      if (this.services?.servicesCatalog?.length >= 0) {
        this.sectionContent[2].isLoaded = true;
        this.sectionContent[2].isEnable = true;
      }
    }
  },
  computed: {
    services() {
      const fetchServicesInstances: EpinioServiceModel[] = this.$store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE);
      const fetchServices: EpinioCatalogService[] = this.$store.getters['epinio/all'](EPINIO_TYPES.CATALOG_SERVICE);

      // Try to find the desired services
      const findDesiredServices = fetchServices?.filter((service) => service.id === 'mysql-dev' || service.id === 'redis-dev');

      //  if not found, return the first two services from the catalog
      const services: EpinioCatalogService[] = findDesiredServices.length ? findDesiredServices : fetchServices.slice(0, 2);

      const s = services.reduce((acc: ComponentService[], service: EpinioCatalogService) => {
        acc.push({
          link:      createEpinioRoute('c-cluster-resource-create', { resource: EPINIO_TYPES.SERVICE_INSTANCE, name: service.id }, { query: { service: service.id } }),
          name:      service.name,
          isEnabled: true
        });

        return acc;
      }, [] as ComponentService[]);

      return {
        servicesInstances: fetchServicesInstances.length,
        servicesCatalog:   s,
      };
    },
    apps() {
      const allApps = this.$store.getters['epinio/all'](EPINIO_TYPES.APP) as EpinioApplicationResource[];

      return allApps.reduce((acc, item) => {
        return {
          runningApps: acc.runningApps + (item.status === 'running' ? 1 : 0),
          stoppedApps: acc.stoppedApps + (item.status === 'error' ? 1 : 0),
          totalApps:   acc.totalApps + 1,
        };
      }, {
        runningApps: 0, stoppedApps: 0, totalApps: 0
      });
    },
    namespaces() {
      const allNamespaces: Namespace[] = this.$store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE);

      return { totalNamespaces: allNamespaces.length, latestNamespaces: sortBy(allNamespaces, 'metadata.createdAt').reverse().slice(0, 2) };
    },
    metricsDetails() {
      return {
        name:   'c-cluster-explorer',
        params: { cluster: this.$store.getters['clusterId'] }
      };
    }
  },
});
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
        <router-link
          v-if="aboutLink"
          :to="aboutLink"
        >
          {{ t('epinio.intro.about') }}
        </router-link>
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
      <router-link
        :to="metricsDetails"
      >
        {{ t('epinio.intro.metrics.link.label') }}
      </router-link>
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
            <slot>
              <ul>
                <li
                  v-for="(ns, i) in namespaces.latestNamespaces"
                  :key="i"
                >
                  {{ ns.id }}
                </li>
              </ul>
            </slot>
          </span>

          <span v-if="index === 1 && apps.totalApps > 0">
            <slot>
              <ConsumptionGauge
                :resource-name="t('epinio.intro.cards.applications.running')"
                :capacity="apps.totalApps"
                :used-as-resource-name="true"
                :color-stops="colorStops"
                :used="apps.runningApps"
                units="Apps"
              />
            </slot>
          </span>

          <span v-if="index === 2">
            <slot>
              <ul>
                <li
                  v-for="(service, i) in services.servicesCatalog"
                  :key="i"
                >
                  <router-link
                    v-if="service.isEnabled"
                    :to="service.link"
                    class="link"
                  >
                    {{ service.name }}
                    <span>+</span>
                  </router-link>

                  <span
                    v-if="!service.isEnabled"
                    class="link disabled"
                  >
                    {{ service.name }}
                    <span>+</span>
                  </span>
                </li>
              </ul>
            </slot>
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
