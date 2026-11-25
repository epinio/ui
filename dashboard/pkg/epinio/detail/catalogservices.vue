<script setup lang="ts">
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { computed, ref, onMounted, watchEffect, watch } from 'vue';
import { debounce } from 'lodash';

import EpinioCatalogServiceModel from '../models/catalogservices';
import { EPINIO_TYPES } from '../types';
import { makeStateTag } from '../utils/table-formatters';
import ServiceDeleteModal from '../components/service/ServiceDeleteModal.vue';
import ServiceInstanceModal from '../components/service/ServiceInstanceModal.vue';
import { makeActionMenu } from '../utils/table-formatters';
import Masthead from '@shell/components/ResourceList/Masthead';
import Banner from '@components/Banner/Banner.vue';
import CatalogServiceModal from '../components/service/CatalogServiceModal.vue';
import CatalogServiceDeleteModal from '../components/service/CatalogServiceDeleteModal.vue';
import { ResourceQueryOptions } from '../models/resource/ui-types';
import { useServices } from '../queries/useServiceQueries';
import { CatalogService } from '../models/catalogservice/ui-types';
import { ServiceInstance, ListServiceInstancesRequestParams } from '../models/service/ui-types';
import { ResourceTableRow } from '../models/resource/ui-types';
import { makeNameLinks } from '../utils/table-formatters';
import { useCatalogService } from '../queries/useCatalogServicesQueries';
import { formatDescriptionHtml } from '../utils/format-description';

const store = useStore();
const router = useRouter();
const t = store.getters['i18n/t'];

const props = defineProps<{ value: EpinioCatalogServiceModel }>();

const resource: string = EPINIO_TYPES.CATALOG_SERVICE;
const serviceDeleteModal = ref<InstanceType<typeof ServiceDeleteModal> | null>(null);
const serviceModal = ref<InstanceType<typeof ServiceInstanceModal> | null>(null);
const catalogServiceModal = ref<InstanceType<typeof CatalogServiceModal> | null>(null);
const catalogServiceDeleteModal = ref<InstanceType<typeof CatalogServiceDeleteModal> | null>(null);
const tableEl = ref<any>(null);
const descriptionInfoOpen = ref(false);

const requestParams = ref<ListServiceInstancesRequestParams>({
  page: 1,
  pageSize: 10,
  search: '',
  namespaces: undefined,
  catalogService: props.value.meta.name,
});

const requestOptions = ref<ResourceQueryOptions>({
  enabled: true,
  polling: true,
  isTablePagination: true,
});

const searchQuery = ref<string>('');

watch(searchQuery, (newQuery) => {
  onSearch(newQuery);
});

const onSearch = debounce(async (query: string) => {
  requestParams.value.page = 1;
  requestParams.value.search = query;
}, 500);

const {data: catalogService, isError: isErrorCatalogService, error: catalogServiceError} = useCatalogService(store, ref(props.value.meta.name));
const {data: services, isLoading: isLoadingServices, isError: isErrorServices, error: servicesError} = useServices(store, requestParams, requestOptions);

const formattedDescription = computed(() => formatDescriptionHtml(catalogService.value?.description));

const titleText = computed(() => t('epinio.catalogService.detail.servicesTitle', {
  catalogService: catalogService.value?.meta.name || props.value.meta.name,
}));

const canEditService = computed(() => {
  const can = store.getters['epinio/can'];

  return can && (can('service_write') || can('service'));
});
const canDeleteService = canEditService;
const canCreateService = canEditService;

const canEditCatalogService = computed(() => {
  const can = store.getters['epinio/can'];

  return can && (can('catalog_service_write') || can('catalog_service'));
});
const canDeleteCatalogService = canEditCatalogService;

const availableActions = computed(() => {
  if (!catalogService.value) {
    return [];
  } 

  const rowActions = (row: CatalogService) => {
    const out: any[] = [];

    if (canCreateService.value) {
      out.push({
        label: t('epinio.services.create.label'),
        enabled: true,
        action: () => serviceModal.value?.openCreate(row.meta.name)
      });
    }
    if (canEditCatalogService.value) {
      out.push({
        label: t('generic.edit'),
        enabled: true,
        action: () => catalogServiceModal.value?.openEdit(row),

      });
    }
    if (canDeleteCatalogService.value) {
      out.push({
        enabled: true,
        label: t('generic.delete'),
        action: () => catalogServiceDeleteModal.value?.openDelete(row),
      });
    }

    return out;
  };

  return rowActions(catalogService.value);
});

const displayRows = computed(() => {
  if (!services.value) {
    return [];
  }
  
  const rows: ResourceTableRow<ServiceInstance>[] = (services.value.items ?? []).map((s) => ({
    ...s,
    id: s.meta.name, // stable, unique per namespace
    availableActions: [{
      label: 'Delete',
      action: () => openServiceDeleteModal(s),
      enabled: canDeleteService.value,
      visible: canDeleteService.value,
      danger: true,
    }, {
      label: 'Edit',
      action: () => openServiceEditModal(s),
      enabled: canEditService.value,
      visible: canEditService.value,
    }],
    canDelete: canDeleteService.value,
  }));
  return rows;
});

// Watch for changes to the active namespace cache and update the request params accordingly
watchEffect(() => {
  void store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;

  if (activeNamespaces && Object.keys(activeNamespaces).length > 0) {
    requestParams.value.namespaces = Object.keys(activeNamespaces);
  } else {
    requestParams.value.namespaces = undefined;
  }
});

const openServiceDeleteModal = (service: ServiceInstance) => {
  serviceDeleteModal.value?.openDelete(service);
};

const openServiceEditModal = (service: ServiceInstance) => {
  serviceModal.value?.openEdit(service);
};

onMounted(() => {
  store.dispatch('epinio/me');
});

// Services without service_write/service permission on that row can't be
// individually deleted, so they're excluded from bulk selection too.
const isRowSelectable = (row: any) => row.canDelete;

// NOTE: must be a named function declared here, not an inline arrow function
// in the template, see feedback_vue_ref_unwrap_bug.md. Vue auto-unwraps
// top-level refs inside template expressions, so referencing `tableEl`
// directly in an inline template callback gives the already-unwrapped
// (initially null) value instead of the Ref object, and `tableEl.value = el`
// throws, silently aborting the rest of the block.
const setTableRef = (el: any) => {
  if (el) {
    tableEl.value = el;
    el.renderActions = makeActionMenu;
    el.rowSelectable = isRowSelectable;
  }
};

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};

const columns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px',
    formatter: (_v: any, row: ServiceInstance) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    formatter: (_v: any, row: ServiceInstance) => {
      const el = document.createElement('a');

      el.textContent = row.meta?.name || '';
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
    field: 'meta.namespace',
    label: 'Namespace'
  },
  {
    field: 'catalogService',
    label: 'Catalog Service',
    sortable: false,
    formatter: (_v: any, row: ServiceInstance) => makeNameLinks(
      [row.catalogService],
      { cluster: store.getters['clusterId'], resource: EPINIO_TYPES.CATALOG_SERVICE },
      router
    )
  },
  {
    field: 'catalogServiceVersion',
    label: 'Catalog Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false,
    formatter: (_v: any, row: ServiceInstance) => makeNameLinks(
      row.boundApps,
      { cluster: store.getters['clusterId'], namespace: row.meta?.namespace, resource: EPINIO_TYPES.APP },
      router
    )
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];

function handleDeleted() {
  store.$router.push({
    name: 'epinio-c-cluster-resource',
    params: {
      ...store.$router.currentRoute.params,
      resource: 'catalogservices',
    },
  });
}
</script>

<template>
  <div id="modal-container-element" class="catalog-service-detail">
    <Masthead
      :schema="value"
      :resource="resource"
      :type-display="titleText"
    >
      <template #subHeader>
        <div class="catalog-title-row">
          <h1 class="catalog-title">{{ titleText }}</h1>
          <div
            v-if="formattedDescription"
            class="service-info"
            @mouseenter="descriptionInfoOpen = true"
            @mouseleave="descriptionInfoOpen = false"
            @focusin="descriptionInfoOpen = true"
            @focusout="descriptionInfoOpen = false"
          >
            <button
              type="button"
              class="service-info-trigger"
              :aria-label="t('epinio.catalogService.detail.descriptionInfo')"
              :aria-expanded="descriptionInfoOpen"
            >
              <trailhand-icon name="info" />
            </button>
            <div
              v-show="descriptionInfoOpen"
              class="service-info-panel"
              role="tooltip"
            >
              <p class="service-info-title">
                {{ t('epinio.services.catalogServiceHelp.title') }}
              </p>
              <div
                v-clean-html="formattedDescription"
                class="service-description-body"
              />
            </div>
          </div>
        </div>
      </template>
      <template #createButton>
        <trailhand-action-menu
          v-if="availableActions.length > 0 && canEditCatalogService"
          :actions="availableActions"
        />
        <div v-else></div>
      </template>
    </Masthead>
    <Banner
      v-if="isErrorServices || isErrorCatalogService"
      color="error"
      :label="servicesError?.message || catalogServiceError?.message || t('epinio.service.errors.fetchAll')"
    />  
    <trailhand-table
      :ref="setTableRef"
      :rows="displayRows"
      :columns="columns"
      :searchable="false"
      :server-side="true"
      :total-items="services?.totalItems ?? 0"
      :current-page="requestParams.page"
      :loading="isLoadingServices"
      key-field="id"
      @navigate="handleNavigate"
      @page-change="(e: CustomEvent) => { requestParams.page = e.detail.page; }"
    />
    <ServiceDeleteModal ref="serviceDeleteModal" />
    <ServiceInstanceModal ref="serviceModal" />
    <CatalogServiceModal ref="catalogServiceModal" />
    <CatalogServiceDeleteModal ref="catalogServiceDeleteModal" @deleted="handleDeleted" />
  </div>
</template>

<style lang="scss" scoped>
.catalog-service-detail {
  // Masthead has no title slot, so we render heading+icon in subHeader
  // and hide the default title row while keeping TabTitle via type-display.
  :deep(header.with-subheader) {
    grid-template-areas:
      'type-banner type-banner'
      'sub-header actions'
      'state-banner state-banner';
  }

  :deep(header.with-subheader .title) {
    display: none;
  }

  :deep(header.with-subheader .sub-header) {
    align-self: center;
  }
}

.catalog-title-row {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.catalog-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.2;
}

.service-info {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.service-info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  padding: 0;
  color: var(--link);
  background: transparent;
  border: none;
  outline: none;
  box-shadow: none;
  cursor: default;

  trailhand-icon {
    font-size: 0.95rem;
    line-height: 1;
  }
}

.service-info-trigger:hover,
.service-info-trigger:focus,
.service-info-trigger:focus-visible {
  background: transparent;
  border: none;
  outline: none;
  box-shadow: none;
}

.service-info-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 20;
  width: min(28rem, 70vw);
  max-width: min(28rem, 70vw);
  padding: 0.75rem 1rem;
  text-align: left !important;
  direction: ltr;
  overflow-wrap: anywhere;
  word-break: break-word;
  background: var(--body-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}

.service-info-title {
  margin: 0 0 0.35rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: left !important;
}

.service-description-body {
  font-size: 0.875rem;
  line-height: 1.5;
  text-align: left !important;
  overflow-wrap: anywhere;
  word-break: break-word;
  color: var(--body-text);

  :deep(a) {
    color: var(--link);
    overflow-wrap: anywhere;
    word-break: break-all;
  }
}
trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}
</style>
