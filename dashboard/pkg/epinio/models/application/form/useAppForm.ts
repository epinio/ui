import { ref, computed, Ref } from "vue";
import { AppForm, App, AppFormSource, AppFormBuildOptions, AppFormDetails, AppFormBindings } from "../ui-types";
import { AppUtils } from "../../../utils/application";
import { toAppForm } from "../mappers";
import { APPLICATION_SOURCE_TYPE, APPLICATION_BUILD_MODE } from "../../../types";
import { ChartSetting } from "models/catalogservice/ui-types";

interface UseAppFormReturn {
    form: Ref<AppForm>;
    populateFormFromRow: (app: App) => AppForm;
    clearForm: () => void;
    resetForm: () => void;
    state: {
        dirty: Ref<boolean>;
        valid: Ref<boolean>;
        source: {
            dirty: Ref<boolean>;
            valid: Ref<boolean>;
        };
        buildOptions: {
            dirty: Ref<boolean>;
            valid: Ref<boolean>;
        };
        details: {
            dirty: Ref<boolean>;
            valid: Ref<boolean>;
        };
        bindings: {
            dirty: Ref<boolean>;
            valid: Ref<boolean>;
        };
    };
    update: {
        source: <K extends AppFormSource['type']>(type: K, newSource?: Partial<NonNullable<AppFormSource[K]>>) => void;
        buildOptions: (newBuildOptions: Partial<AppFormBuildOptions>) => void;
        details: (newDetails: Partial<AppFormDetails>) => void;
        bindings: (newBindings: Partial<AppFormBindings>) => void;
        chartSettings: (chartSettings: ChartSetting[]) => void;
    };
}

export function useAppForm(): UseAppFormReturn {
    const form = ref<AppForm>(initEmptyForm());
    const initialForm = ref<AppForm>(initEmptyForm());

    const chartSettingsForValidation = ref<ChartSetting[]>([]);

    function initEmptyForm(): AppForm {
        return {
            source: {
                type: 'folder'
            },
            buildOptions: {},
            details: {
                namespace: '',
                name: '',
                instances: 1,
                routes: [],
                settings: {},
                environment: []
            },
            bindings: {
                services: [],
                configurations: [],
                serviceConfigurations: []
            }
        }
    }

    const isFormDirty = computed(() => {
        return JSON.stringify(form.value) !== JSON.stringify(initialForm.value);
    });

    const isFormValid = computed(() => {
        return isSourceValid.value && isBuildOptionsValid.value && isDetailsValid.value && isBindingsValid.value;
    });

    const isSourceDirty = computed(() => {
        return JSON.stringify(form.value.source) !== JSON.stringify(initialForm.value.source);
    });

    const isSourceValid = computed(() => {
        switch (form.value.source.type) {
            case APPLICATION_SOURCE_TYPE.ARCHIVE:
            case APPLICATION_SOURCE_TYPE.FOLDER:
                return !!form.value.source[form.value.source.type]?.tarball;
            case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
                return !!form.value.source.containerUrl?.url;
            case APPLICATION_SOURCE_TYPE.GIT_URL:
                return !!form.value.source.gitUrl?.url && !!form.value.source.gitUrl?.branch;
            case APPLICATION_SOURCE_TYPE.GIT_HUB:
            case APPLICATION_SOURCE_TYPE.GIT_LAB:
                return !!form.value.source[form.value.source.type]?.userOrOrg && !!form.value.source[form.value.source.type]?.repository
                    && !!form.value.source[form.value.source.type]?.branch && !!form.value.source[form.value.source.type]?.commit;
            default:
                return false;
        }
    });

    const isBuildOptionsDirty = computed(() => {
        return JSON.stringify(form.value.buildOptions) !== JSON.stringify(initialForm.value.buildOptions);
    });

    const isBuildOptionsValid = computed(() => {
        function validateDockerfilePathValue(value: string): boolean {
            const trimmed = (value || '').trim();
            if (!trimmed) {
                return false;
            }
            if (
                trimmed.startsWith('/') ||
                trimmed.startsWith('\\') ||
                /^[A-Za-z]:[\\/]/.test(trimmed) ||
                trimmed.startsWith('\\\\')
            ) {
                return false;
            }

            const normalized = trimmed.replace(/\\/g, '/');
            if (normalized.split('/').some((part) => part === '..')) {
                return false;
            }

            if (!/^[A-Za-z0-9._/-]+$/.test(normalized)) {
                return false;
            }

            return true;
        }

        // An empty builder image is legal when the catalog cannot be read: the server
        // resolves its own default (request, then app CR, then default CR, then env).
        const hasBuilderImage = form.value.buildOptions.buildMode === APPLICATION_BUILD_MODE.BUILDPACK
            && (!!form.value.buildOptions.builderImage || !!form.value.buildOptions.builderImagesForbidden);

        switch (form.value.source.type) {
            case APPLICATION_SOURCE_TYPE.ARCHIVE:
            case APPLICATION_SOURCE_TYPE.FOLDER:
                if (form.value.buildOptions.buildMode === APPLICATION_BUILD_MODE.DOCKERFILE) {
                    const dockerfileValid = validateDockerfilePathValue(form.value.buildOptions.dockerfilePath || '');
                    return !!form.value.buildOptions.dockerfilePath && dockerfileValid;
                }
                return hasBuilderImage;
            case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
            return true;
            case APPLICATION_SOURCE_TYPE.GIT_URL:
                if (form.value.buildOptions.buildMode === APPLICATION_BUILD_MODE.DOCKERFILE) {
                    const dockerfileValid = validateDockerfilePathValue(form.value.buildOptions.dockerfilePath || '');
                    return !!form.value.buildOptions.dockerfilePath && dockerfileValid;
                }
                return hasBuilderImage;
            case APPLICATION_SOURCE_TYPE.GIT_HUB:
            case APPLICATION_SOURCE_TYPE.GIT_LAB:
                if (form.value.buildOptions.buildMode === APPLICATION_BUILD_MODE.DOCKERFILE) {
                    const dockerfileValid = validateDockerfilePathValue(form.value.buildOptions.dockerfilePath || '');
                    return !!form.value.buildOptions.dockerfilePath && dockerfileValid;
                }
                return hasBuilderImage;
            default:
                return false;
        }
    });

    const isDetailsDirty = computed(() => {
        return JSON.stringify(form.value.details) !== JSON.stringify(initialForm.value.details);
    });

    const isDetailsValid = computed(() => {
        const validName = !!form.value.details?.name;

        // Namespace must be selected (not empty) and pass naming validation
        const namespaceValue = form.value.details?.namespace || '';
        const hasNamespace = !!namespaceValue;
        const validNamespace = hasNamespace;
        const validInstances = form.value.details?.instances >= 0;
        const validSettings = chartSettingsForValidation.value.every((setting) => {
            if (setting.type !== 'number' && setting.type !== 'integer') {
                return true;
            }

            const rawValue = form.value.details.settings[setting.name];

            if (rawValue === undefined || rawValue === null || rawValue === '') {
                return true;
            }

            const value = Number(rawValue);

            if (Number.isNaN(value)) {
                return false;
            }

            if ((setting.minimum != null && setting.minimum !== undefined) && value < Number(setting.minimum)) {
                return false;
            }

            if ((setting.maximum != null && setting.maximum !== undefined) && value > Number(setting.maximum)) {
                return false;
            }

            return true;
        });

        return validName && validNamespace && validInstances && validSettings;
    });

    const isBindingsDirty = computed(() => {
        return JSON.stringify(form.value.bindings) !== JSON.stringify(initialForm.value.bindings);
    });

    const isBindingsValid = computed(() => {
        return true;
    });

    function populateFormFromRow(app: App) {
        const appForm = toAppForm(app);
        form.value = appForm;
        initialForm.value = structuredClone(appForm);

        return form.value;
    }

    function clearForm() {
        form.value = structuredClone(initEmptyForm());
    }

    function resetForm() {
        form.value = structuredClone(initialForm.value);
    }

    function updateSource<K extends AppFormSource['type']>(
        type: K,
        newSource?: Partial<NonNullable<AppFormSource[K]>>
    ) {
        form.value.source = {
            ...form.value.source,
            type,
            [type]: {
                ...form.value.source[type],
                ...newSource
            }
        };
    }

    function updateBuildOptions(newBuildOptions: Partial<AppFormBuildOptions>) {
        form.value.buildOptions = {
            ...form.value.buildOptions,
            ...newBuildOptions
        };
    }

    function updateDetails(newDetails: Partial<AppFormDetails>) {
        form.value.details = {
            ...form.value.details,
            ...newDetails
        };
    }

    function updateBindings(newBindings: Partial<AppFormBindings>) {
        form.value.bindings = {
            ...form.value.bindings,
            ...newBindings
        };
    }

    function updateChartSettings(chartSettings: ChartSetting[]) {
        chartSettingsForValidation.value = chartSettings;
    }

    return {
        form,
        populateFormFromRow,
        clearForm,
        resetForm,
        state: {
            dirty: isFormDirty,
            valid: isFormValid,
            source: {
                dirty: isSourceDirty,
                valid: isSourceValid,
            },
            buildOptions: {
                dirty: isBuildOptionsDirty,
                valid: isBuildOptionsValid
            },
            details: {
                dirty: isDetailsDirty,
                valid: isDetailsValid
            },
            bindings: {
                dirty: isBindingsDirty,
                valid: isBindingsValid
            }
        },
        update: {
            source: updateSource,
            buildOptions: updateBuildOptions,
            details: updateDetails,
            bindings: updateBindings,
            chartSettings: updateChartSettings
        }
    }
}