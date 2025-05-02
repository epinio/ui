import { EPINIO_TYPES } from '../types';
import { createEpinioRoute } from '../utils/custom-routing';
import EpinioMetaResource from './epinio-namespaced-resource';
//import { EPINIO_SERVICE_PARAM } from '../edit/services.vue';

export default class EpinioCatalogServiceModel extends EpinioMetaResource {
  //private type: string;
  //private id: string;
  //private appVersion: string;

  get _availableActions(): { 
    action: string, 
    label: string, 
    icon: string, 
    enabled: boolean,
  }[] {
    return [{
      action:  'createService',
      label:   this.t('generic.create'),
      icon:    'icon icon-fw icon-chevron-up',
      enabled: true,
    }];
  }

  get links(): { [key: string]: string } {
    return {
      update: this.getUrl(),
      self:   this.getUrl(),
      remove: this.getUrl(),
      create: this.getUrl(undefined), // ensure name is null
    };
  }
  
  getUrl(name: string = this.meta?.name): string {
    // Add baseUrl in a generic way
    return this.$getters['urlFor'](
      this.type, 
      this.id, 
      { url: `/api/v1/catalogservices/${ name || '' }` },
    );
  }

  /*get details(): { label: string, content: any, formatter?: string, formatterOpts?: any }[] {
    return [
      {
        label:   this.t('epinio.catalogService.detail.appVersion'),
        content: this.appVersion,
      }
    ];
  }*/

  get services(): any[] {
    return this.$getters['all'](EPINIO_TYPES.SERVICE_INSTANCE)
      .filter((s: any) => {
        return s.catalog_service === this.name;
      });
  }

  /*createService(): Promise<any> {
    const serviceCreateLocation = createEpinioRoute(`c-cluster-resource-create`, {
      cluster:  this.$rootGetters['clusterId'],
      resource: EPINIO_TYPES.SERVICE_INSTANCE,
    });

    return this.currentRouter().push({
      ...serviceCreateLocation,
      query: { [EPINIO_SERVICE_PARAM]: this.name }
    });
  }*/
}
