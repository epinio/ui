import isObject from 'lodash/isObject';

export function objValuesToString(obj: any) {
  const copy = { ...obj };

  for (const key in copy) {
    if (isObject(copy[key])) {
      copy[key] = objValuesToString(copy[key]);
    } else if (typeof copy[key] !== 'string') {
      copy[key] = String(copy[key]);
    }
  }

  return copy;
}
