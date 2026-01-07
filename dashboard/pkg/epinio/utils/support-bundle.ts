import { downloadFile } from '@shell/utils/download';

export interface SupportBundleOptions {
  includeAppLogs?: boolean;
  tail?: number;
}

/**
 * Error codes for support bundle download errors
 * These can be used for translation keys in components
 */
export enum SupportBundleErrorCode {
  INVALID_TAIL = 'INVALID_TAIL',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  ADMIN_REQUIRED = 'ADMIN_REQUIRED',
  SERVER_ERROR = 'SERVER_ERROR',
  INVALID_PARAMS = 'INVALID_PARAMS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  GENERIC_ERROR = 'GENERIC_ERROR'
}

/**
 * Custom error class for support bundle errors
 */
export class SupportBundleError extends Error {
  constructor(
    message: string,
    public code: SupportBundleErrorCode,
    public originalError?: any
  ) {
    super(message);
    this.name = 'SupportBundleError';
  }
}

/**
 * Downloads a support bundle from the Epinio API
 * @param store - Vuex store instance (typed as any to match codebase pattern)
 * @param options - Download options
 * @param options.includeAppLogs - Include application logs (default: false)
 * @param options.tail - Number of lines per component (default: 1000, max: 10000)
 * @returns Promise with filename
 * @throws {SupportBundleError} If tail parameter is invalid (must be between 1 and 10000)
 * @throws {SupportBundleError} If authentication fails (401)
 * @throws {SupportBundleError} If user lacks admin permissions (403)
 * @throws {SupportBundleError} If server error occurs (500)
 * @throws {SupportBundleError} If network error occurs
 */
export async function downloadSupportBundle(
  store: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  options: SupportBundleOptions = {}
): Promise<{ filename: string }> {
  const {
    includeAppLogs = false,
    tail = 1000,
  } = options;

  // Validate tail parameter - ensure it's a number and within range
  if (typeof tail !== 'number' || isNaN(tail) || tail < 1 || tail > 10000) {
    throw new SupportBundleError(
      'Tail parameter must be a number between 1 and 10000',
      SupportBundleErrorCode.INVALID_TAIL
    );
  }

  // Build query string
  const params = new URLSearchParams();
  if (includeAppLogs) {
    params.append('include_app_logs', 'true');
  }
  if (tail !== 1000) {
    params.append('tail', tail.toString());
  }

  const queryString = params.toString();
  const url = `/api/v1/support-bundle${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await store.dispatch('epinio/request', {
      opt: {
        url,
        method: 'GET',
        responseType: 'blob',
        timeout: 600000, // 10 minutes timeout for large bundles
        headers: {
          'Accept': 'application/gzip, application/octet-stream',
          'x-cap-long-running': 'true' // Tell backend to use long-running timeout (10 minutes)
        }
      }
    });

    // Get filename from Content-Disposition header
    // Normalize header keys to lowercase for case-insensitive matching
    const headers = response._headers || {};
    const getHeader = (key: string): string | undefined => {
      const lowerKey = key.toLowerCase();
      for (const [headerKey, value] of Object.entries(headers)) {
        if (headerKey.toLowerCase() === lowerKey) {
          return value as string;
        }
      }
      return undefined;
    };

    const contentDisposition = getHeader('content-disposition');
    let filename = 'epinio-support-bundle.tar.gz';
    
    if (contentDisposition) {
      // Handle both formats: filename="..." and filename*=UTF-8''... (RFC 5987)
      let filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
      if (!filenameMatch) {
        filenameMatch = contentDisposition.match(/filename=([^;\n]+)/i);
      }
      
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].trim();
        // Remove quotes if present
        filename = filename.replace(/^['"]|['"]$/g, '');
        // Decode URL-encoded filenames
        try {
          filename = decodeURIComponent(filename);
        } catch (e) {
          // If decoding fails, use the original filename
        }
        // Sanitize filename - remove path components and dangerous characters
        filename = filename.replace(/[\/\\:*?"<>|]/g, '_').replace(/^\.+/, '');
        // Ensure we have a valid filename
        if (!filename || filename.length === 0) {
          filename = 'epinio-support-bundle.tar.gz';
        }
      }
    }
    
    // Fallback: generate filename with timestamp if extraction failed
    // Format: YYYYMMDD-HHMMSS (e.g., 20240115-143022)
    if (filename === 'epinio-support-bundle.tar.gz' && !contentDisposition) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${year}${month}${day}-${hours}${minutes}${seconds}`;
      filename = `epinio-support-bundle-${timestamp}.tar.gz`;
    }

    // Get blob and trigger download
    // When responseType is 'blob', axios returns the blob directly in response.data
    let blob: Blob;
    if (response.data instanceof Blob) {
      blob = response.data;
    } else if (response.data) {
      blob = new Blob([response.data], { type: 'application/gzip' });
    } else {
      throw new SupportBundleError(
        'Invalid response: no blob data received',
        SupportBundleErrorCode.INVALID_RESPONSE
      );
    }
    
    // Use downloadFile utility with error handling
    try {
      await downloadFile(filename, blob, 'application/gzip');
    } catch (downloadError) {
      throw new SupportBundleError(
        'Failed to save support bundle. Please check your browser download settings.',
        SupportBundleErrorCode.DOWNLOAD_FAILED,
        downloadError
      );
    }

    return { filename };
  } catch (error: any) {
    console.error('Error downloading support bundle:', error);
    
    // Handle network errors (no response object)
    if (!error.response && !error._status) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new SupportBundleError(
          'Request timed out. The support bundle may be large. Please try again.',
          SupportBundleErrorCode.TIMEOUT,
          error
        );
      }
      throw new SupportBundleError(
        'Network error. Please check your connection and try again.',
        SupportBundleErrorCode.NETWORK_ERROR,
        error
      );
    }
    
    // Handle specific HTTP error cases
    // Check both _status (custom property) and response.status (standard axios)
    const status = error._status || error.response?.status;
    
    if (status === 401) {
      throw new SupportBundleError(
        'Authentication required. Please log in.',
        SupportBundleErrorCode.AUTH_REQUIRED,
        error
      );
    } else if (status === 403) {
      throw new SupportBundleError(
        'Admin access required to download support bundles.',
        SupportBundleErrorCode.ADMIN_REQUIRED,
        error
      );
    } else if (status === 500) {
      throw new SupportBundleError(
        'Failed to generate support bundle. Please try again later.',
        SupportBundleErrorCode.SERVER_ERROR,
        error
      );
    } else if (status === 400) {
      throw new SupportBundleError(
        'Invalid parameters. Please check your input and try again.',
        SupportBundleErrorCode.INVALID_PARAMS,
        error
      );
    } else if (error instanceof SupportBundleError) {
      // Re-throw SupportBundleError as-is
      throw error;
    } else if (error.message) {
      // Wrap other errors
      throw new SupportBundleError(
        error.message,
        SupportBundleErrorCode.GENERIC_ERROR,
        error
      );
    } else {
      throw new SupportBundleError(
        'Failed to download support bundle. Please try again.',
        SupportBundleErrorCode.GENERIC_ERROR,
        error
      );
    }
  }
}

