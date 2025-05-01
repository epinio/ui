import Resource from '@shell/plugins/dashboard-store/resource-class';
import { EPINIO_PRODUCT_NAME } from '../types';

interface Application {
  id: string;
  meta: {
    name: string;
  };
  linkFor: (type: string) => string;
}

export default class ApplicationInstanceResource extends Resource {
  application?: Application; // Define the type of application based on your application
 
  name: string;
  ready: boolean;

  constructor(data: {name: string, ready: boolean }, ctx: any){
    super(data, ctx);
    this.name = data.name;
    this.ready = data.ready;
  }

  get _availableActions(): Array<{ 
    action: string; 
    label: string; 
    icon: string; 
    enabled: boolean;
  }> {
    return [{
      action:  'showAppShell',
      label:   this.t('epinio.applications.actions.onlyShell.label'),
      icon:    'icon icon-fw icon-chevron-right',
      enabled: this.ready,
    }];
  }

  get state(): 'ready' | 'notready' | 'pending' {
    switch (this.ready) {
      case true:
        return 'ready';
      case false:
        return 'notready';
      default:
        return 'pending';
    }
  }

  showAppShell(): void {
    this.$dispatch('wm/open', {
      id:        `epinio-${this.application?.id}-app-shell`,
      label:     `${this.application?.meta.name} - App Shell`,
      product:   EPINIO_PRODUCT_NAME,
      icon:      'chevron-right',
      component: 'ApplicationShell',
      attrs:     {
        application:     this.application,
        endpoint:        this.application?.linkFor('shell'),
        initialInstance: this.name,
      }
    }, { root: true });
  }
}
