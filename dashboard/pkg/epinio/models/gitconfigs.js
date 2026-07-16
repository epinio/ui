import EpinioNamespacedResource from './epinio-namespaced-resource';

export default class EpinioGitConfigModel extends EpinioNamespacedResource {
  get links() {
    return {
      self:   this.getUrl(),
      update: this.getUrl(),
      remove: this.getUrl(),
      create: this.getUrl(null), // null name for collection endpoint
    };
  }

  getUrl(name = this.metadata?.name) {
    return this.$getters['urlFor'](this.type, this.id, { url: `/api/v1/gitconfigs/${ name || '' }` });
  }

  async create() {
    await this.followLink('create', {
      method:  'post',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json',
      },
      data: {
        id:               this.id,
        url:              this.url,
        provider:         this.provider,
        username:         this.username,
        password:         this.password,
        certs:            this.certs,
        skipssl:          this.skipssl,
        global:           this.global,
      }
    });
  }

  async remove(unmounted = true) {
    await this._remove({ data: { unmounted } });
  }
}