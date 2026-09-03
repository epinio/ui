import { isArray } from '@shell/utils/array';

// The epinio store's request action rejects with a response object carrying a
// non-enumerable _status when the body parsed, and the raw axios error when it
// did not, so both shapes have to be read to spot an authorization refusal.
export function isForbidden(err: any): boolean {
  return (err?._status ?? err?.response?.status) === 403;
}

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
