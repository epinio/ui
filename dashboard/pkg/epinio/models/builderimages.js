import EpinioNamespacedResource from './epinio-namespaced-resource';

export default class EpinioBuilderImageModel extends EpinioNamespacedResource {
  get links() {
    return {
      self:   this.getUrl(),
      update: this.getUrl(),
      remove: this.getUrl(),
      create: this.getUrl(null), // null name for collection endpoint
    };
  }

  getUrl(name = this.metadata?.name) {
    return this.$getters['urlFor'](this.type, this.id, { url: `/api/v1/builderimages/${ name || '' }` });
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
        image:            this.image,
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
        image:            this.image,
      }
    });
  }

  async remove(unmounted = true) {
    await this._remove({ data: { unmounted } });
  }
}