<script setup lang="ts">
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { ref, onMounted, watchEffect } from 'vue';

import EpinioCatalogServiceModel from '../models/catalogservices';
import { EPINIO_TYPES } from '../types';
import { makeStateTag, makeRouterLink, makeRouterLinksOrEmpty, makeActionMenu } from '../utils/table-formatters';
import ServiceInstanceModal from '../components/service/ServiceInstanceModal.vue';

const store = useStore();
const router = useRouter();
const t = store.getters['i18n/t'];

const props = defineProps<{ value: EpinioCatalogServiceModel }>();

const pending = ref<boolean>(true);
const serviceModal = ref<InstanceType<typeof ServiceInstanceModal> | null>(null);
const displayRows = ref<any[]>([]);

onMounted(async () => {
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  pending.value = false;
});

watchEffect(() => {
  const rows = props.value.services as any[];

  const overrides = rows.map((row) => {
    Object.defineProperty(row, 'availableActions', {
      value: [
        { action: 'editServiceModal', label: 'Edit', enabled: true },
        { action: 'remove', altAction: 'remove', label: 'Delete', enabled: row.canDelete, bulkable: true, bulkAction: 'remove' },
      ],
      writable: true,
      configurable: true,
    });
    Object.defineProperty(row, 'editServiceModal', {
      value: () => serviceModal.value?.openEdit(row),
      writable: true,
      configurable: true,
    });

    return row;
  });

  displayRows.value = [...overrides];
});

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
    formatter: (_v: any, row: any) => {
      const el = document.createElement('a');

      el.textContent = row.nameDisplay || row.meta?.name || '';
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        serviceModal.value?.openView(row);
      });

      return el;
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
  <div id="modal-container-element">
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
    <ServiceInstanceModal ref="serviceModal" />
  </div>
</template>

<style lang="scss" scoped>
trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}
</style>
