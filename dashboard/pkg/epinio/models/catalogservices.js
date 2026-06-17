import { EPINIO_TYPES } from '@pkg/types';
import { createEpinioRoute } from '@pkg/utils/custom-routing';
import EpinioMetaResource from './epinio-namespaced-resource';
import { EPINIO_SERVICE_PARAM } from '../types';

export default class EpinioCatalogServiceModel extends EpinioMetaResource {
  get _availableActions() {
    return [{
      action:  'createService',
      label:   'Create Service',
      icon:    'icon icon-fw icon-chevron-up',
      enabled: true,
    }];
  }

  get links() {
    return {
      update: this.getUrl(),
      self:   this.getUrl(),
      remove: this.getUrl(),
      create: this.getUrl(null), // ensure name is null
    };
  }

  getUrl(name = this.meta?.name) {
    // Add baseUrl in a generic way
    return this.$getters['urlFor'](this.type, this.id, { url: `/api/v1/catalogservices/${ name || '' }` });
  }

  get details() {
    return [
      {
        label:   this.t('epinio.catalogService.detail.appVersion'),
        content: this.appVersion,
      }
    ];
  }

  get services() {
    return this.$getters['all'](EPINIO_TYPES.SERVICE_INSTANCE)
      .filter((s) => {
        return s.catalog_service === this.name;
      });
  }

  async create() {
    await this.followLink('create', {
      method:  'post',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json',
      },
      data: {
        name:             this.name,
        description:      this.description,
        shortDescription: this.short_description,
        chart:            this.chart,
        chartVersion:     this.chart_version,
        appVersion:       this.app_version,
        serviceIcon:      this.icon,
        helmRepo:         this.helm_repo,
        settings:         this.settings,
        secretTypes:      this.secret_types,
      }
    });
  }

  async update() {
    await this.followLink('update', {
      method:  'patch',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json',
      },
      data: {
        description:      this.description,
        shortDescription: this.short_description,
        chart:            this.chart,
        chartVersion:     this.chart_version,
        appVersion:       this.app_version,
        serviceIcon:      this.icon,
        helmRepo:         this.helm_repo,
        settings:         this.settings,
        values:           this.values,
        secretTypes:      this.secret_types,
      }
    });
  }

  async remove(unmounted = true) {
    await this._remove({ data: { unmounted } });
  }

  createService() {
    const serviceListLocation = createEpinioRoute(`c-cluster-resource`, {
      cluster:  this.$rootGetters['clusterId'],
      resource: EPINIO_TYPES.SERVICE_INSTANCE,
    });

    return this.currentRouter().push({
      ...serviceListLocation,
      query: { mode: 'openModal', [EPINIO_SERVICE_PARAM]: this.name }
    });
  }
}
