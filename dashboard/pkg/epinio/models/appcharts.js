import EpinioMetaResource from './epinio-namespaced-resource';

export default class EpinioAppChartModel extends EpinioMetaResource {
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

  canEdit = true;
  canDelete = true;

  // get _availableActions() {
  //   const base = super._availableActions || [];
  //   const can = this.$rootGetters?.['epinio/can'];
  //   const perms = this.$rootGetters?.['epinio/permissions']?.();

  //   if (!can || !perms || Object.keys(perms).length === 0) {
  //     return base;
  //   }

  //   const canEdit = can('chart_write');
  //   const canDelete = can('chart_write');

  //   return base.filter((action) => {
  //     if (action.action === '') {
  //       return canEdit;
  //     }
  //     if (action.action === 'promptRemove') {
  //       return canDelete;
  //     }
  //     return true;
  //   });
  // }

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
        helmChart:        this.helm_chart,
        helmRepo:         this.helm_repo,
        settings:         this.settings,
      }
    });
  }

  async update() {
    await this.followLink('update', {
      method:  'put',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json',
      },
      data: {
        description:      this.description,
        shortDescription: this.short_description,
        helmChart:        this.helm_chart,
        helmRepo:         this.helm_repo,
        settings:         this.settings,
      }
    });
  }
}