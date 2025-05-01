import EpinioMetaResource from './epinio-namespaced-resource';

export default class EpinioAppChartModel extends EpinioMetaResource {
  type: string;
  id: string;

  constructor(type: string, id: string) {
    super();
    this.type = type;
    this.id = id;
  }

  get links(): { update: string; self: string } {
    return {
      update: this.getUrl(),
      self: this.getUrl(),
    };
  }

  getUrl(name: string | undefined = this.metadata?.name): string {
    // Add baseUrl in a generic way
    return this.$getters['urlFor'](
      this.type, 
      this.id, 
      { url: `/api/v1/appcharts/${name || ''}` },
    );
  }
}

