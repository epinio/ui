<script setup lang="ts">
import { computed } from 'vue';

export interface ConfigSetting {
  name: string;
  type: 'string' | 'number' | 'integer' | 'bool';
  enum?: string[];
  minimum?: string;
  maximum?: string;
  value?: any;
}

const props = defineProps<{
  modelValue: ConfigSetting[];
  disabled?: boolean;
  allowDefaults?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ConfigSetting[]): void;
}>();

const settings = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

function updateSetting(index: number, patch: Partial<ConfigSetting>) {
  const next = [...settings.value];
  next[index] = {
    ...next[index],
    ...patch,
  };

  settings.value = next;
}

function removeSetting(index: number) {
  const next = [...settings.value];
  next.splice(index, 1);
  settings.value = next;
}

function addSetting() {
  settings.value = [
    ...settings.value,
    {
      name: '',
      type: 'string',
      enum: [],
    },
  ];
}
</script>

<template>
  <trailhand-form-row>
    <h3>Settings</h3>
  </trailhand-form-row>

  <template
    v-for="(setting, index) in settings"
    :key="index"
  >
    <trailhand-form-row columns="2">
      <trailhand-text-input
        :value="setting.name"
        label="Setting Name"
        :disabled="disabled"
        required
        @text-input-change="
          (e) => updateSetting(index, { name: e.detail.value })
        "
      />

      <div style="display:flex;align-items:flex-end;gap:16px;">
        <trailhand-dropdown
          :value="setting.type"
          label="Setting Type"
          :disabled="disabled"
          required
          style="flex:1;"
          :options="[
            { label: 'String', value: 'string' },
            { label: 'Number', value: 'number' },
            { label: 'Integer', value: 'integer' },
            { label: 'Boolean', value: 'bool' }
          ]"
          @dropdown-change="
            (e) => {
              const value = e.detail.value;

              updateSetting(index, {
                type: value,
                enum:
                  value === 'string'
                    ? (setting.enum ?? [])
                    : undefined,
                minimum:
                  value === 'number' || value === 'integer'
                    ? setting.minimum
                    : undefined,
                maximum:
                  value === 'number' || value === 'integer'
                    ? setting.maximum
                    : undefined,
                value: undefined,
              });
            }
          "
        />

        <trailhand-dropdown
          v-if="setting.type === 'bool' && props.allowDefaults"
          :value="setting.value"
          label="Default Value"
          :disabled="disabled"
          style="flex:1;"
          :options="[
            { label: 'True', value: true },
            { label: 'False', value: false }
          ]"
          @dropdown-change="
            (e) => updateSetting(index, { value: e.detail.value })
          "
        />

        <trailhand-button
          variant="destructive"
          :disabled="disabled"
          @button-click="removeSetting(index)"
        >
          Remove
        </trailhand-button>
      </div>
    </trailhand-form-row>

    <trailhand-form-row
      v-if="setting.type === 'number' || setting.type === 'integer'"
      columns="3"
    >
      <trailhand-text-input
        :value="setting.minimum"
        label="Minimum"
        type="number"
        :disabled="disabled"
        @text-input-change="
          (e) => updateSetting(index, { minimum: e.detail.value })
        "
      />

      <trailhand-text-input
        :value="setting.maximum"
        label="Maximum"
        type="number"
        :disabled="disabled"
        @text-input-change="
          (e) => updateSetting(index, { maximum: e.detail.value })
        "
      />

      <trailhand-text-input
        v-if="props.allowDefaults"
        :value="setting.value"
        label="Default Value"
        type="number"
        :min="setting.minimum"
        :max="setting.maximum"
        :disabled="disabled"
        @text-input-change="
          (e) => updateSetting(index, { value: e.detail.value })
        "
      />
    </trailhand-form-row>

    <trailhand-form-row
      v-if="setting.type === 'string'"
      columns="2"
    >
      <div
        style="
          display:flex;
          flex-direction:column;
          gap:8px;
          width:100%;
        "
      >
        <div
          v-for="(value, enumIndex) in setting.enum || []"
          :key="enumIndex"
          style="
            display:flex;
            align-items:flex-end;
            gap:8px;
          "
        >
          <trailhand-text-input
            :value="value"
            label="Allowed Value"
            :disabled="disabled"
            style="flex:1;"
            @text-input-change="
              (e) => {
                const next = [...(setting.enum || [])];
                next[enumIndex] = e.detail.value;
                updateSetting(index, { enum: next });
              }
            "
          />

          <trailhand-button
            variant="destructive"
            :disabled="disabled"
            @button-click="
              () => {
                const next = [...(setting.enum || [])];
                next.splice(enumIndex, 1);
                updateSetting(index, { 
                  enum: next,
                  value: (!next || next.length === 0)
                    ? ''
                    : setting.value, 
                });
              }
            "
          >
            Remove Value
          </trailhand-button>
        </div>

        <div>
          <trailhand-button
            variant="alternate"
            :disabled="disabled"
            @button-click="
              () => {
                updateSetting(index, {
                  enum: [...(setting.enum || []), ''],
                  value: (!setting.enum || setting.enum.length === 0)
                    ? ''
                    : setting.value,
                })

              }
            "
          >
            Add Value
          </trailhand-button>
        </div>
      </div>

      <div style="display:flex;align-items:flex-start;" v-if="props.allowDefaults">
        <trailhand-dropdown
          v-if="setting.enum && setting.enum.length > 0"
          :value="setting.value"
          label="Default Value"
          :disabled="
            disabled ||
            !(setting.enum && setting.enum.some((v) => v))
          "
          style="flex:1;"
          :options="
            (setting.enum || [])
              .filter((v) => v)
              .map((v) => ({
                label: v,
                value: v,
              }))
          "
          @dropdown-change="
            (e) => updateSetting(index, { value: e.detail.value })
          "
        />
        <trailhand-text-input
          v-else
          :value="setting.value"
          label="Default Value"
          :disabled="disabled"
          style="flex:1;"
          @text-input-change="
            (e) => updateSetting(index, { value: e.detail.value })
          "
        />
      </div>
    </trailhand-form-row>

    <div
      style="
        width:100%;
        border-bottom:1px solid var(--th-color-border);
      "
    />
  </template>

  <div>
    <trailhand-button
      variant="alternate"
      :disabled="disabled"
      @button-click="addSetting"
    >
      Add Setting
    </trailhand-button>
  </div>
</template>