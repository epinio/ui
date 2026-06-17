import { ConfigSetting } from "components/settings/ChartSettings.vue";

export function objValuesToString(obj: any) {
  const copy = { ...obj };

  for (const key in copy) {
    if (typeof copy[key] !== 'string') {
      copy[key] = JSON.stringify(copy[key]);
    }
  }

  return copy;
}

export function mapSettingsFromApiResponse(apiResponse: any) {
  const mappedSettings = Object.keys(apiResponse.settings || {}).map((key) => ({
    name: key,
    type: apiResponse.settings[key].type || 'string',
    enum: apiResponse.settings[key].enum || [],
    minimum: apiResponse.settings[key].minimum || '',
    maximum: apiResponse.settings[key].maximum || '',
    value: apiResponse.values?.[key] ?? (apiResponse.settings[key].type === 'bool' ? false : ''),
  }));
  return mappedSettings;
}

export function mapSettingsToApiRequest(chartSettings: ConfigSetting[]) {
  const settings = chartSettings.reduce((acc, setting) => {
    acc[setting.name] = { type: setting.type };
    if (setting.type === 'string' && setting.enum) {
      acc[setting.name].enum = setting.enum.filter((v) => v);
    }
    if ((setting.type === 'number' || setting.type === 'integer') && setting.minimum !== undefined) {
      acc[setting.name].minimum = String(setting.minimum); // string not number
    }
    if ((setting.type === 'number' || setting.type === 'integer') && setting.maximum !== undefined) {
      acc[setting.name].maximum = String(setting.maximum); // string not number
    }
    return acc;
  }, {} as Record<string, any>);

  const values = objValuesToString(chartSettings.reduce((acc, setting) => {
    acc[setting.name] = setting.value;
    return acc;
  }, {} as Record<string, any>));

  return { settings, values };
}

export function validateSettings(chartSettings: ConfigSetting[]) {
  for (const setting of chartSettings) {
    if (!setting.name) {
      return false;
    }
    const minimum = setting.minimum ? Number(setting.minimum) : NaN;
    const maximum = setting.maximum ? Number(setting.maximum) : NaN;

    if (setting.type === 'number' || setting.type === 'integer') {
      if (!isNaN(minimum) && !isNaN(maximum) && minimum >= maximum) {
        return false;
      }

      const value = setting.value ? Number(setting.value) : NaN;
      if (!isNaN(value)) {
        if (!isNaN(minimum) && value < minimum) {
          return false;
        }
        if (!isNaN(maximum) && value > maximum) {
          return false;
        }
      }
    }

    if (setting.type === 'string') {
      if (!setting.enum || setting.enum.length === 0 || setting.enum.some((v) => !v)) {
        return false;
      }
    }
  }
  return true;
}
