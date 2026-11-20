import { defineComponent } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils';
import AppConfiguration from '../../../components/application/AppConfiguration.vue';
import { useServices } from '../../../queries/useServiceQueries';

const mockStore = { getters: { 'i18n/t': (key: string) => key } };

jest.mock('vuex', () => ({ useStore: () => mockStore }));
jest.mock('../../../queries/useServiceQueries', () => {
  const { ref } = jest.requireActual('vue');

  return {
    useServices: jest.fn(() => ({
      data: ref({
        items: [
          { meta: { name: 'db' }, catalogService: 'postgresql-dev' },
          { meta: { name: 'cache' }, catalogService: 'redis-dev' },
        ]
      }),
      isLoading: ref(false),
      isError:   ref(false),
    }))
  };
});
jest.mock('../../../queries/useConfigurationQueries', () => {
  const { ref } = jest.requireActual('vue');

  return {
    useConfigurations: jest.fn(() => ({
      data: ref({
        items: [
          { meta: { name: 'app-env' }, configuration: { type: 'custom' } },
          { meta: { name: 'db-creds' }, configuration: { type: 'service' } },
        ]
      }),
      isLoading: ref(false),
      isError:   ref(false),
    }))
  };
});

const TrailhandDropdown = defineComponent({
  name:     'TrailhandDropdown',
  props:    {
    options:  { type: Array, default: () => [] },
    values:   { type: Array, default: () => [] },
    disabled: Boolean,
    label:    { type: String, default: '' },
  },
  emits:    ['dropdown-change', 'dropdown-filter'],
  template: '<div />',
});

const mountConfig = (props: Record<string, any> = {}) => {
  const updateBindings = jest.fn();
  const wrapper = mount(AppConfiguration, {
    props: {
      bindings:  { configurations: [], services: [], serviceConfigurations: [] },
      namespace: 'workspace',
      mode:      'create',
      active:    true,
      updateBindings,
      ...props,
    },
    global: { components: { 'trailhand-dropdown': TrailhandDropdown } },
  });

  return { wrapper, updateBindings };
};

const dropdown = (wrapper: VueWrapper, label: string) => wrapper.findAllComponents(TrailhandDropdown).find((d) => d.props('label') === label)!;
const configs = (wrapper: VueWrapper) => dropdown(wrapper, 'typeLabel.configurations');
const services = (wrapper: VueWrapper) => dropdown(wrapper, 'typeLabel.services');

beforeEach(() => jest.clearAllMocks());

it('only queries once a namespace is chosen, scoped to that namespace', async() => {
  const { wrapper } = mountConfig({ namespace: '' });
  const [, params, options] = (useServices as jest.Mock).mock.calls[0];

  expect(options.value.enabled).toBe(false);

  await wrapper.setProps({ namespace: 'workspace' });

  expect(options.value.enabled).toBe(true);
  expect(params.value.namespaces).toEqual(['workspace']);

  await wrapper.setProps({ namespace: '' });

  expect(options.value.enabled).toBe(false);
});

it('leaves service-owned configurations out of the configuration list', () => {
  const { wrapper } = mountConfig();

  expect(configs(wrapper).props('options')).toEqual([{ label: 'app-env', value: 'app-env' }]);
});

it('sends picked configurations as names', () => {
  const { wrapper, updateBindings } = mountConfig();

  configs(wrapper).vm.$emit('dropdown-change', { detail: { values: ['app-env'] } });

  expect(updateBindings).toHaveBeenCalledWith({ configurations: ['app-env'] });
});

it('lists services with their catalog and namespaced values', () => {
  const { wrapper } = mountConfig({ bindings: { configurations: [], services: ['db'], serviceConfigurations: [] } });

  expect(services(wrapper).props('options')).toEqual([
    { label: 'db (postgresql-dev)', value: 'workspace/db' },
    { label: 'cache (redis-dev)', value: 'workspace/cache' },
  ]);
  expect(services(wrapper).props('values')).toEqual(['workspace/db']);
});

it('strips the namespace prefix before sending picked services', () => {
  const { wrapper, updateBindings } = mountConfig();

  services(wrapper).vm.$emit('dropdown-change', { detail: { values: ['workspace/db', 'workspace/cache'] } });

  expect(updateBindings).toHaveBeenCalledWith({ services: ['db', 'cache'] });
});
