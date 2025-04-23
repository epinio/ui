<script>
import ResourceTable from '@shell/components/ResourceTable';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import LinkDetail from '@shell/components/formatter/LinkDetail';
import { EPINIO_TYPES } from '../../../../types';
import { createEpinioRoute } from '../../../../utils/custom-routing';

export default {
  components: {
    LinkDetail,
    Loading,
    Masthead,
    ResourceTable,
  },
  async fetch() {
    await this.$store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP });
    // Don't block on these, they can show asyncronously
    this.$store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.CONFIGURATION });
    this.$store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  },

  data() {
    const resource = EPINIO_TYPES.APP;
    const schema = this.$store.getters[`epinio/schemaFor`](resource);

    return {
      schema,
      resource,
    };
  },

  computed: {
    headers() {
      return this.$store.getters['type-map/headersFor'](this.schema);
    },

    groupBy() {
      return this.$store.getters['type-map/groupByFor'](this.schema);
    },

    createLocation() {
      return createEpinioRoute(`c-cluster-applications-createapp`, { cluster: this.$store.getters['clusterId'] });
    },

    rows() {
      return this.$store.getters['epinio/all'](this.resource);
    },

    hasNamespaces() {
      return !!this.$store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE)?.length;
    }
  },

};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else>
    <Masthead
      :schema="schema"
      :resource="resource"
      :create-location="createLocation"
    />
    <ResourceTable
      :schema="schema"
      :rows="rows"
      :headers="headers"
      :group-by="groupBy"
    >
      <template #cell:configurations="{ row }">
        <span v-if="row.baseConfigurations.length">
          <template v-for="(configuration, index) in row.baseConfigurations" :key="index">
            <LinkDetail
             
              :row="configuration"
              :value="configuration.meta.name"
            />
            <span
              v-if="index < row.baseConfigurations.length - 1"
             
            >, </span>
          </template>
        </span>
        <span
          v-else
          class="text-muted"
        >&nbsp;</span>
      </template>
      <template #cell:services="{ row }">
        <span v-if="row.services.length">
          <template v-for="(service, index) in row.services" :key="index">
            <LinkDetail
             
              :row="service"
              :value="service.meta.name"
            />
            <span
              v-if="index < row.services.length - 1"
             
            >, </span>
          </template>
        </span>
        <span
          v-else
          class="text-muted"
        >&nbsp;</span>
      </template>
      <template #cell:route="{ row }">
        <span
          v-if="row.routes.length"
          class="route"
        >
          <template v-for="(route, index) in row.routes" :key="index">
            <a
              v-if="row.state === 'running'"
             
              :href="`https://${route}`"
              target="_blank"
              rel="noopener noreferrer nofollow"
            >{{ `https://${route}` }}</a>
            <span
              v-else
             
            >{{ `https://${route}` }}</span>
            <span
              v-if="index < row.routes.length - 1"
             
            >, </span>
          </template>
        </span>
        <span
          v-else
          class="text-muted"
        >&nbsp;</span>
      </template>
    </ResourceTable>
  </div>
</template>

<style lang="scss" scoped>
.route {
  word-break: break-all;
}
</style>
