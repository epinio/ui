/**
 * Type definitions for DataTable component
 */

export type SortDirection = 'asc' | 'desc';

export interface DataTableRow {
  [key: string]: any;
}

/**
 * DataTable formatters for common column types
 */
export const dataTableFormatters = {
  /**
   * Format a date value as relative time (e.g., "5d", "3h", "15m")
   */
  age: (value: any): string => {
    if (!value) return '-';
    const date = new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    if (diffMins > 0) return `${diffMins}m`;
    return 'Just now';
  },

  /**
   * Format a date as a localized date string
   */
  date: (value: any): string => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString();
  },

  /**
   * Format a date as a localized date and time string
   */
  dateTime: (value: any): string => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  },

  /**
   * Format memory bytes using SI units (B, KiB, MiB, GiB, TiB)
   * Same logic as formatSi from @shell/utils/units with binary units
   */
  memory: (value: any): string => {
    if (!value || value === 0) return '0 B';

    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let unitIndex = 0;
    let val = Number(value);

    while (val >= 1024 && unitIndex < units.length - 1) {
      val /= 1024;
      unitIndex++;
    }

    return `${val.toFixed(2)} ${units[unitIndex]}`;
  },

  /**
   * Format milliCPUs as a decimal number
   * Same logic as used in the application model's _instanceStats
   */
  milliCPUs: (value: any): string => {
    if (!value || value === 0) return '0';

    const formatted = Number(value).toFixed(2);
    return formatted === '0.00' ? '0' : formatted;
  }
};

export interface DataTableColumn {
  /**
   * Unique identifier for the column, used to access row data
   */
  field: string;

  /**
   * Display label for the column header
   */
  label: string;

  /**
   * Optional fixed width for the column (e.g., '100px', '20%')
   */
  width?: string;

  /**
   * Whether this column is sortable (default: true)
   */
  sortable?: boolean;

  /**
   * Whether this column is searchable (default: true)
   */
  searchable?: boolean;

  /**
   * Formatter to transform cell values. Can be:
   * - A string name from dataTableFormatters ('age', 'date', 'dateTime')
   * - A custom function (value, row) => formatted value
   * @param value - The raw cell value
   * @param row - The entire row object
   * @returns The formatted value to display
   */
  formatter?: string | ((value: any, row: DataTableRow) => any);

  /**
   * Custom sort function for this column
   * @param a - First row to compare
   * @param b - Second row to compare
   * @param direction - Current sort direction
   * @returns Comparison result (-1, 0, 1)
   */
  sortFn?: (a: DataTableRow, b: DataTableRow, direction: SortDirection) => number;
}

export interface DataTableProps {
  /**
   * Array of column definitions
   */
  columns: DataTableColumn[];

  /**
   * Array of row data objects
   */
  rows: DataTableRow[];

  /**
   * Number of rows to display per page (default: 10)
   */
  rowsPerPage?: number;

  /**
   * Enable/disable search functionality (default: true)
   */
  searchable?: boolean;

  /**
   * Enable/disable column sorting (default: true)
   */
  sortable?: boolean;

  /**
   * Enable/disable pagination (default: true)
   */
  paginated?: boolean;

  /**
   * Loading state for the table (default: false)
   */
  loading?: boolean;

  /**
   * Field to use as unique key for rows (default: 'id')
   */
  keyField?: string;
}

/**
 * Methods exposed by the component via defineExpose
 */
export interface DataTableExposed {
  /**
   * Navigate to a specific page
   */
  goToPage: (page: number) => void;

  /**
   * Navigate to the next page
   */
  nextPage: () => void;

  /**
   * Navigate to the previous page
   */
  prevPage: () => void;

  /**
   * Clear the search query
   */
  resetSearch: () => void;

  /**
   * Reset sort to default state
   */
  resetSort: () => void;
}
