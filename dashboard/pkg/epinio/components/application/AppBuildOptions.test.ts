import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, reactive, ref } from 'vue';
import AppBuildOptions from './AppBuildOptions.vue';
import { useBuilderImages } from '../../queries/useBuilderImagesQueries';
import { useAppCharts } from '../../queries/useAppChartsQueries';
import { APPLICATION_BUILD_MODE, APPLICATION_SOURCE_TYPE } from '../../types';

jest.mock('vuex', () => ({
  useStore: () => ({ getters: { 'i18n/t': (key: string) => key } }),
}));
jest.mock('../../queries/useBuilderImagesQueries', () => ({ useBuilderImages: jest.fn() }));
jest.mock('../../queries/useAppChartsQueries', () => ({ useAppCharts: jest.fn() }));
// utils/errors pulls in @rancher/shell TypeScript that jest does not transform;
// forbidden-error handling is not under test here.
jest.mock('../../utils/errors', () => ({ isForbidden: () => false }));

const DEFAULT_IMAGE = 'paketobuildpacks/builder-jammy-base:0.1.0';
const OTHER_IMAGE = 'paketobuildpacks/builder-jammy-full:0.2.0';

const builderImageCatalog = {
  items: [
    { image: DEFAULT_IMAGE, default: true, meta: { name: 'base' }, shortDescription: 'Base' },
    { image: OTHER_IMAGE, default: false, meta: { name: 'full' }, shortDescription: 'Full' },
  ],
};

// Stand-ins for the trailhand web components. They expose their props so the
// test can assert on them, and the test emits the events they would fire.
const TrailhandDropdown = defineComponent({
  name: 'TrailhandDropdown',
  props: ['options', 'value', 'label', 'isLoading'],
  render() {
    return h('div');
  },
});

const TrailhandTextInput = defineComponent({
  name: 'TrailhandTextInput',
  props: ['value', 'label', 'placeholder', 'disabled'],
  render() {
    return h('input');
  },
});

function mountBuildOptions(initialBuilderImage = DEFAULT_IMAGE) {
  const buildOptions = reactive({
    appChart: 'standard',
    buildMode: APPLICATION_BUILD_MODE.BUILDPACK,
    builderImage: initialBuilderImage,
    dockerfilePath: '',
    builderImagesForbidden: false,
  });
  const modalOpen = ref(true);

  const Parent = defineComponent({
    setup() {
      return () =>
        h(AppBuildOptions, {
          buildOptions,
          sourceType: APPLICATION_SOURCE_TYPE.ARCHIVE,
          mode: 'create',
          active: true,
          modalOpen: modalOpen.value,
          updateBuildOptions: (partial: Record<string, unknown>) => Object.assign(buildOptions, partial),
          updateDetails: () => {},
        });
    },
  });

  const wrapper = mount(Parent, {
    global: {
      stubs: {
        'trailhand-dropdown': TrailhandDropdown,
        'trailhand-text-input': TrailhandTextInput,
      },
    },
  });

  const builderDropdown = () =>
    wrapper.findAllComponents(TrailhandDropdown).find((c) => c.props('label') === 'Builder Image');
  const builderTextInput = () => wrapper.findComponent(TrailhandTextInput);

  const chooseFromDropdown = async (value: string) => {
    builderDropdown()!.vm.$emit('dropdown-change', { detail: { value } });
    await nextTick();
  };
  const typeIntoBuilderInput = async (value: string) => {
    builderTextInput().vm.$emit('text-input-change', { detail: { value } });
    await nextTick();
  };
  const setModalOpen = async (open: boolean) => {
    modalOpen.value = open;
    await nextTick();
  };

  return {
    wrapper,
    buildOptions,
    builderDropdown,
    builderTextInput,
    chooseFromDropdown,
    typeIntoBuilderInput,
    setModalOpen,
  };
}

describe('AppBuildOptions builder image selection (EPINIO-811)', () => {
  beforeEach(() => {
    (useBuilderImages as jest.Mock).mockReturnValue({
      data: ref(builderImageCatalog),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    });
    (useAppCharts as jest.Mock).mockReturnValue({
      data: ref({ items: [{ meta: { name: 'standard' }, shortDescription: 'Standard' }] }),
      isLoading: ref(false),
      isError: ref(false),
    });
  });

  it('keeps the current catalog image in the text box when Custom is chosen', async () => {
    const ctx = mountBuildOptions(DEFAULT_IMAGE);

    await ctx.chooseFromDropdown('custom');

    expect(ctx.builderDropdown()!.props('value')).toBe('custom');
    expect(ctx.buildOptions.builderImage).toBe(DEFAULT_IMAGE);
    expect(ctx.builderTextInput().props('disabled')).toBe(false);
  });

  it('stays in Custom when a pasted value matches a catalog image', async () => {
    const ctx = mountBuildOptions(DEFAULT_IMAGE);
    await ctx.chooseFromDropdown('custom');

    await ctx.typeIntoBuilderInput(OTHER_IMAGE);

    expect(ctx.buildOptions.builderImage).toBe(OTHER_IMAGE);
    expect(ctx.builderDropdown()!.props('value')).toBe('custom');
    expect(ctx.builderTextInput().props('disabled')).toBe(false);
  });

  it('returns to the catalog entry and locks the text box when a catalog image is picked after Custom', async () => {
    const ctx = mountBuildOptions(DEFAULT_IMAGE);
    await ctx.chooseFromDropdown('custom');
    await ctx.typeIntoBuilderInput(OTHER_IMAGE);

    await ctx.chooseFromDropdown(DEFAULT_IMAGE);

    expect(ctx.buildOptions.builderImage).toBe(DEFAULT_IMAGE);
    expect(ctx.builderDropdown()!.props('value')).toBe(DEFAULT_IMAGE);
    expect(ctx.builderTextInput().props('disabled')).toBe(true);
  });

  it('derives the selection from the form value when the modal is reopened', async () => {
    const ctx = mountBuildOptions(DEFAULT_IMAGE);
    await ctx.chooseFromDropdown('custom');
    await ctx.typeIntoBuilderInput(OTHER_IMAGE);

    await ctx.setModalOpen(false);
    await ctx.setModalOpen(true);

    expect(ctx.builderDropdown()!.props('value')).toBe(OTHER_IMAGE);
    expect(ctx.builderTextInput().props('disabled')).toBe(true);
  });
});
