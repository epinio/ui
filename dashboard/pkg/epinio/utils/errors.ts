import { isArray } from '@shell/utils/array';

// HTTP 507 Insufficient Storage - used for quota exceeded errors
const HTTP_STATUS_INSUFFICIENT_STORAGE = 507;

/**
 * Checks if an error is a quota exceeded error (HTTP 507 or HTTP 500 with quota in body)
 */
export function isQuotaExceededError(err: any): boolean {
  if (!err) {
    return false;
  }

  // Check response status code
  if (err?.response?.status === HTTP_STATUS_INSUFFICIENT_STORAGE) {
    return true;
  }

  // Check error status directly
  if (err?.status === HTTP_STATUS_INSUFFICIENT_STORAGE) {
    return true;
  }

  // Check response.data.errors array (as per issue #2105 - status 500 with quota in body)
  if (err?.response?.data?.errors && Array.isArray(err.response.data.errors)) {
    const hasQuotaError = err.response.data.errors.some((e: any) => {
      // Check for HTTP 507 status in error object
      if (e.status === HTTP_STATUS_INSUFFICIENT_STORAGE) {
        return true;
      }
      // Check for HTTP 500 with quota-related messages (as per issue #2105)
      if (e.status === 500) {
        const errorText = (e.title || e.message || '').toLowerCase();
        return errorText.includes('quota exceeded') ||
               errorText.includes('quotaexceeded') ||
               errorText.includes('insufficient storage');
      }
      // Check error title/message for quota keywords regardless of status
      const errorText = (e.title || e.message || '').toLowerCase();
      return errorText.includes('quota exceeded') ||
             errorText.includes('quotaexceeded') ||
             errorText.includes('insufficient storage') ||
             errorText.includes('storage quota');
    });
    if (hasQuotaError) {
      return true;
    }
  }

  // Check top-level error message for quota-related keywords (safely, without JSON.stringify)
  const errorMessage = err?.message || err?.title || err?.error || '';
  if (errorMessage && typeof errorMessage === 'string') {
    const lowerMessage = errorMessage.toLowerCase();
    return lowerMessage.includes('quota exceeded') ||
           lowerMessage.includes('quotaexceeded') ||
           lowerMessage.includes('insufficient storage') ||
           lowerMessage.includes('storage quota');
  }

  return false;
}

/**
 * Gets a user-friendly message for quota exceeded errors
 * Returns only the core error message without guidance (guidance is added in actions.ts)
 */
export function getQuotaExceededMessage(err: any): string {
  const defaultMessage = 'Storage quota exceeded';
  
  if (err?.title) {
    return err.title;
  }
  
  if (err?.response?.data?.errors?.[0]?.title) {
    return err.response.data.errors[0].title;
  }
  
  if (err?.message && typeof err.message === 'string' && err.message.includes('quota')) {
    return err.message;
  }
  
  return defaultMessage;
}

export function epinioExceptionToErrorsArray(err: any): any {
  // Check for quota exceeded errors first and provide user-friendly message
  if (isQuotaExceededError(err)) {
    return [getQuotaExceededMessage(err)];
  }

  if (err?.errors?.length === 1) {
    return epinioExceptionToErrorsArray(err?.errors[0]);
  }

  if ( err?.response?.data ) {
    const body = err.response.data;

    // Check if the response contains quota errors
    if (body?.errors && Array.isArray(body.errors)) {
      // Check for HTTP 507 status or error messages containing quota keywords
      const quotaError = body.errors.find((e: any) => {
        if (e.status === HTTP_STATUS_INSUFFICIENT_STORAGE) {
          return true;
        }
        // Also check for 500 status with quota-related messages (as per issue #2105)
        const errorText = (e.title || e.message || '').toLowerCase();
        return e.status === 500 && (
          errorText.includes('quota exceeded') ||
          errorText.includes('quotaexceeded') ||
          errorText.includes('insufficient storage')
        );
      });
      if (quotaError) {
        return [quotaError.title || getQuotaExceededMessage(err)];
      }
    }

    if ( body && body.message ) {
      return [body.message];
    } else {
      return [err];
    }
  } else if (err.status && err.title) {
    const title = err.title;
    const detail = err.detail ? ` - ${ err.detail }` : '';

    return [`${ title }${ detail }`];
  } else if ( isArray(err) ) {
    return err;
  } else {
    return [err];
  }
}
