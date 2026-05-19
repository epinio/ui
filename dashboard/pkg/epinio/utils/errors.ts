import { isArray } from '@shell/utils/array';

export function epinioExceptionToErrorsArray(err: any): any {
  const formatError = (item: any) => {
    if (!item) {
      return '';
    }

    if (typeof item === 'string') {
      return item;
    }

    const status = item.status ? `[${ item.status }] ` : '';
    const title = item.title || item.message || '';
    const details = item.details || item.detail || '';

    return `${ status }${ title }${ details ? ` - ${ details }` : '' }`.trim();
  };

  const normalize = (input: any): string[] => {
    if (!input) {
      return ['Unknown error'];
    }

    if (isArray(input)) {
      return input.map(formatError).filter(Boolean);
    }

    if (input?.errors && isArray(input.errors)) {
      return input.errors.map(formatError).filter(Boolean);
    }

    if (input?.message) {
      return [input.message];
    }

    const formatted = formatError(input);

    return formatted ? [formatted] : ['Unknown error'];
  };

  if (err?.response?.data) {
    return normalize(err.response.data);
  }

  return normalize(err);
}
