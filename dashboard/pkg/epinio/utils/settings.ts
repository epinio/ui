export function objValuesToString(obj: any) {
  const copy = { ...obj };

  for (const key in copy) {
    if (typeof copy[key] !== 'string') {
      copy[key] = JSON.stringify(copy[key]);
    }
  }

  return copy;
}
