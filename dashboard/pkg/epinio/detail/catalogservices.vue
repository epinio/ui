<script setup lang="ts">
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { ref, onMounted, watchEffect } from 'vue';

import EpinioCatalogServiceModel from '../models/catalogservices';
import { EPINIO_TYPES } from '../types';
import { makeStateTag, makeRouterLink, makeRouterLinksOrEmpty, overrideTableRows } from '../utils/table-formatters';
import ServiceDeleteModal from '../components/service/ServiceDeleteModal.vue';
import EpinioServiceModel from 'models/services';
import { makeActionMenu } from '../utils/table-formatters';

const store = useStore();
const router = useRouter();
const t = store.getters['i18n/t'];

const props = defineProps<{ value: EpinioCatalogServiceModel }>();

const pending = ref<boolean>(true);
const deleteModal = ref<InstanceType<typeof ServiceDeleteModal> | null>(null);
const displayRows = ref<any[]>([]);

onMounted(async () => {
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  pending.value = false;
});

watchEffect(() => {
  const rows = props.value.services || [] as any[];

  // Filter empty rows that are added during delete
  const filtered = rows.filter((row: any) => row.id);

  // Add custom service delete action to replace the built in rancher shell flow
  const overrideProps = [{
    prop: 'availableActions',
    value: (row: EpinioServiceModel) => {
      const newActions: any[] = [];
      const availableActions = row.availableActions || [];
      availableActions.forEach((action) => {
        if (action.action === 'promptRemove') {
          newActions.push({
            action: 'removeService',
            altAction: 'remove',
            bulkAction: 'removeService',
            bulkable: true,
            enabled: row.canDelete,
            icon: 'icon icon-trash',
            label: 'Delete',
            weight: -10
          });
        } else {
          newActions.push(action);
        }
      });
      return newActions;
    },
    conditionFn: (row: EpinioServiceModel) => {
      return row.canDelete;
    },
  },
  {
    prop: 'removeService',
    value: (row: EpinioServiceModel) => () => {
      deleteModal.value?.openDelete(row);
    },
    conditionFn: (row: EpinioServiceModel) => {
      return row.canDelete;
    },
  }];

  const processedRows = overrideTableRows(filtered, overrideProps);
  displayRows.value = processedRows;
})

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};

const columns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px',
    formatter: (_v: any, row: any) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    link:  (row: any) => {
      try { return router.resolve(row.detailLocation).href; } catch { return '#'; }
    }
  },
  {
    field: 'catalog_service',
    label: 'Catalog Service',
    sortable:  false,
    formatter: (_v: any, row: any) => makeRouterLink(row.catalog_service, row.serviceLocation, router)
  },
  {
    field: 'catalog_service_version',
    label: 'Catalog Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable:  false,
    formatter: (_v: any, row: any) => makeRouterLinksOrEmpty(row.applications, router)
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];
</script>

<template>
  <div>
    <h2 class="mt-20">
      {{ t('epinio.catalogService.detail.servicesTitle', { catalogService: props.value.name }) }}
    </h2>
    <trailhand-table
      :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
      :rows="displayRows"
      :columns="columns"
      :searchable="true"
      key-field="id"
      @navigate="handleNavigate"
    />
    <ServiceDeleteModal ref="deleteModal" />
  </div>
</template>

<style lang="scss" scoped>
trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}
</style>
