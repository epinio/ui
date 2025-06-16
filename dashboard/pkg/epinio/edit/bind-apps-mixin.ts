import { useStore } from 'vuex';
import { ref, computed } from 'vue';

import { EPINIO_TYPES } from '../types';

import { sortBy } from '@shell/utils/sort';

export function useEpinioBindAppsMixin(props: any) {
  const selectedApps = ref<Array<string>>(props.value?.boundapps || []);
  const store = useStore();

  const allApps = computed(() => {
    return sortBy(
      store.getters['epinio/all'](EPINIO_TYPES.APP),
      'meta.name',
      false,
    );
  });

  const nsApps = computed(() => {
    return allApps.value.filter((a: any) => a.meta.namespace === props.value.meta.namespace);
  });

  const nsAppOptions = computed(() => {
    return nsApps.value.map((a: any) => ({
      label: a.meta.name,
      value: a.meta.name,
    }));
  });

  const noApps = computed(() => {
    return nsAppOptions.value.length === 0;
  });

  const updateServiceInstanceAppBindings = async (serviceInstance: any) => {
    // Service instance must be ready before they can be bound to apps
    await waitForServiceInstanceReady(serviceInstance);
    
    const bindApps = selectedApps.value;
    const unbindApps = (props.initialValue.boundapps || []).filter(
      (bA: any) => !bindApps.includes(bA)
    );

    const promises = [
      ...bindApps.map((bA) => props.value.bindApp(bA)),
      ...unbindApps.map((uBA: any) => props.value.unbindApp(uBA))
    ];

    await Promise.all(promises);
  };

  const waitForServiceInstanceReady = async (serviceInstance: any) => {
    // It would be nice to use waitForState here, but we need to manually update until Epinio pumps out updates via socket
    await serviceInstance.waitForTestFn(() => {
      const freshServiceInstance = store.getters['epinio/byId'](
        EPINIO_TYPES.SERVICE_INSTANCE, 
        `${ serviceInstance.meta.namespace }/${ serviceInstance.meta.name }`,
      );

      if (freshServiceInstance) {
        return true;
      }
      // This is an async fn, but we're in a sync fn. It might create a backlog if previous requests don't complete in time
      serviceInstance.forceFetch();
    }, `service instance exists`, 30000, 2000).catch((err: Error) => {
      console.warn(err);
      throw new Error('waitingForServiceInstance');
    });

    // Wait, because `not-ready` does not indicate service is ready to bind to. See https://github.com/epinio/ui/issues/289
    await new Promise((res) => setTimeout(res, 2000));
  };

  const updateConfigurationAppBindings = async () => {
    const bindApps = selectedApps.value;
    const unbindApps = (props.initialValue.configuration?.boundapps || []).
      filter((bA: any) => !bindApps.includes(bA));

    const delta = nsApps.value.reduce((res: any, nsA: any) => {
      const appName = nsA.metadata.name;
      const configName = props.value.metadata.name;

      const toBind = [];
      const toUnbind = [];

      if (bindApps.includes(appName) && !nsA.configuration.configurations.includes(configName)) {
        toBind.push(configName);
      } else if (unbindApps.includes(appName)) {
        const index = nsA.configuration.configurations.indexOf(configName);

        if (index >= 0) {
          toUnbind.push(configName);
        }
      }

      res.push(nsA.bindConfigurations(toBind));
      res.push(nsA.unbindConfiguration(toUnbind));

      return res;
    }, []);

    if (delta.length) {
      await Promise.all(delta);
      await props.value.forceFetch();
    }
  };

  const doneParams = computed(() => {
    if (props.value?.doneParams) {
      return props.value.doneParams;
    }
    
    const out = { ...(store as any).$router.currentRoute._value.params };

    delete out.namespace;
    delete out.id;

    return out;
  });

  const doneRoute = computed(() => {
    let route: string = '';

    if (props.value?.doneRoute ) {
      route = props.value.doneRoute;
    }else{
      let name = props.route.name;

      if ( name?.endsWith('-id') ) {
        name = name.replace(/(-namespace)?-id$/, '');
      } else if ( name?.endsWith('-create') ) {
        name = name.replace(/-create$/, '');
      }

      route = name;
    }

    return route;
  });

  return {
    doneParams,
    doneRoute,
    selectedApps,
    allApps,
    nsApps,
    nsAppOptions,
    noApps,
    updateServiceInstanceAppBindings,
    waitForServiceInstanceReady,
    updateConfigurationAppBindings,
  };
}
