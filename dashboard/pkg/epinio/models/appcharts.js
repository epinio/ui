import EpinioNamespacedResource from './epinio-namespaced-resource';

export default class EpinioAppChartModel extends EpinioNamespacedResource {
  get links() {
    return {
      self:   this.getUrl(),
      update: this.getUrl(),
      remove: this.getUrl(),
      create: this.getUrl(null), // null name for collection endpoint
    };
  }

  getUrl(name = this.metadata?.name) {
    return this.$getters['urlFor'](this.type, this.id, { url: `/api/v1/appcharts/${ name || '' }` });
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
        short_description: this.short_description,
        helm_chart:        this.helm_chart,
        helm_repo:         this.helm_repo,
        settings:         this.settings,
        values:           this.values,
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
        short_description: this.short_description,
        helm_chart:        this.helm_chart,
        helm_repo:         this.helm_repo,
        settings:         this.settings,
        values:           this.values,
      }
    });
  }

  async remove(unmounted = true) {
    await this._remove({ data: { unmounted } });
  }
}