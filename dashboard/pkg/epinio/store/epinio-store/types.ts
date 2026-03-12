/**
 * Payload types for epinio-store actions/mutations.
 * Using interfaces avoids TS1005 when "type" is used as a property name (reserved keyword).
 */

export interface SetPaginationPagePayload {
  type: string;
  page: number;
}

export interface SetPaginationMetaPayload {
  type: string;
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
