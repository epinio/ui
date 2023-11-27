import EpinioMetaResource from './epinio-namespaced-resource';

export default class EpinioGitConfigModel extends EpinioMetaResource {
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
    return this.$getters['urlFor'](this.type, this.id, { url: `/api/v1/gitconfigs/${ name || '' }` });
  }

  // ------------------------------------------------------------------

  async create() {
    await this.followLink('create', {
      method:  'post',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json'
      },
      data: {
        id:         this.meta.name,
        password:   this.password,
        provider:   this.provider,
        repository: this.repository,
        skipssl:    this.skipssl,
        url:        this.url,
        username:   this.username,
        userorg:    this.userorg
      }
    });
  }

  // async update() {
  //   await this.followLink('update', {
  //     method:  'put',
  //     headers: {
  //       'content-type': 'application/json',
  //       accept:         'application/json'
  //     },
  //     data: {
  //       id:         this.meta.name,
  //       password:   this.password,
  //       provider:   this.provider,
  //       repository: this.repository,
  //       skipssl:    this.skipssl,
  //       url:        this.url,
  //       username:   this.username,
  //       userorg:    this.userorg
  //     }
  //   });
  // }
}
