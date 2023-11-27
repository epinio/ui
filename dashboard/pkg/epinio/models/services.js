import { createEpinioRoute } from '@pkg/utils/custom-routing';
import { EPINIO_TYPES } from '../types';
import EpinioNamespacedResource, { bulkRemove } from './epinio-namespaced-resource';

export default class EpinioServiceModel extends EpinioNamespacedResource {
  get links() {
    return {
      update: this.getUrl(),
      self:   this.getUrl(),
      remove: this.getUrl(),
      bind:   `${ this.getUrl() }/bind`,
      unbind: `${ this.getUrl() }/unbind`,
      create: this.getUrl(this.metadata?.namespace, null) // ensure name is null
    };
  }

  getUrl(namespace = this.metadata?.namespace, name = this.metadata?.name) {
    // getUrl(namespace = this.meta?.namespace, name = this.meta?.name) {
    // Add baseUrl in a generic way
    return this.$getters['urlFor'](this.type, this.id, { url: `/api/v1/namespaces/${ namespace }/services/${ name || '' }` });
  }

  // ------------------------------------------------------------------

  get applications() {
    // map bound app names to app models
    return (this.boundapps || [])
      .map((ba) => {
        return (this.$getters['all'](EPINIO_TYPES.APP) || []).find(
          (a) => a.meta.namespace === this.meta.namespace && a.meta.name === ba
        );
      })
      .filter((a) => !!a);
  }

  get serviceDetails() {
    return this._serviceDetails;
  }

  /**
   * Return the dashboard reserved getter for `details` (shown in MastHead)
   */
  get details() {
    return super.details;
  }

  /**
   * When assigning Epinio details property ensure it goes to a temp value (instead of colliding with dashboard reserved `details` getter)
   */
  set details(v) {
    this._serviceDetails = v;
  }

  // ------------------------------------------------------------------
  get state() {
    return this.status;
  }

  get serviceLocation() {
    return createEpinioRoute(`c-cluster-resource-id`, {
      cluster:  this.$rootGetters['clusterId'],
      resource: EPINIO_TYPES.CATALOG_SERVICE,
      id:       this.catalog_service
    });
  }

  async create() {
    const t = this.settings;
    debugger;
    await this.followLink('create', {
      method:  'post',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json'
      },
      data: {
        name:            this.name,
        catalog_service: this.catalog_service,
        settings:        this.settings
      }
    });
  }

  async update() {
    await this.followLink('update', {
      method:  'put',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json'
      },
      data: { settings: this.settings }
    });
  }

  async bindApp(appName) {
    await this.followLink('bind', {
      method:  'post',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json'
      },
      data: { app_name: appName }
    });
  }

  async unbindApp(appName) {
    await this.followLink('unbind', {
      method:  'post',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json'
      },
      data: { app_name: appName }
    });
  }

  async delete(unbind = true) {
    await this._remove({ data: { unbind } });
  }

  async remove() {
    await this.delete(true);
  }

  bulkRemove(items, opt) {
    return bulkRemove(items, opt);
  }

  // Ensure when we clone that we preserve the description
  toJSON() {
    const data = super.toJSON();

    // Ensure the epinio detail gets persisted in the right property
    data.details = this._serviceDetails;
    delete data._serviceDetails;

    return data;
  }

  toSave() {
    return this.toJSON();
  }
}
