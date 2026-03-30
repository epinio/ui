import { isArray } from '@shell/utils/array';

export function epinioExceptionToErrorsArray(err: any): any {
  if (err?.errors?.length === 1) {
    return epinioExceptionToErrorsArray(err?.errors[0]);
  }

  if ( err?.response?.data ) {
    const body = err.response.data;

    if (body && typeof body === 'object') {
      if (body.message) {
        return [body.message];
      }
      if (body.title) {
        const detail = body.detail ? ` - ${ body.detail }` : '';
        return [`${ body.title }${ detail }`];
      }
      if (body.errors?.length) {
        // Return the first nested error message if possible.
        return [body.errors[0]?.title || body.errors[0]?.message || JSON.stringify(body.errors[0])];
      }
      return [err?.message || err];
    }

    if (typeof body === 'string') {
      const s = body.trim();
      const m = s.match(/(Gateway Time-out|context deadline exceeded|timeout|timed out)/i);
      if (m) {
        return [m[0] + (s.length > 120 ? '...' : '')];
      }
      return [s.length > 240 ? s.slice(0, 240) + '...' : s];
    }

    return [err?.message || err];
  } else if (err.status && err.title) {
    const title = err.title;
    const detail = err.detail ? ` - ${ err.detail }` : '';

    return [`${ title }${ detail }`];
  } else if ( isArray(err) ) {
    return err;
  } else {
    return [err?.message || err];
  }
}
