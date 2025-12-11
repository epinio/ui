/**
 * Helper utilities for working with trailhand-ui data-table component
 */

/**
 * Create a data-table element with the given configuration
 * @param columns - Column definitions
 * @param rows - Data rows
 * @param options - Additional table options
 * @returns The created table element
 */
export function createDataTable(
  columns: any[],
  rows: any[],
  options: {
    rowActions?: boolean;
    searchable?: boolean;
    sortable?: boolean;
    paginated?: boolean;
    rowsPerPage?: number;
  } = {}
): HTMLElement {
  const tableElement = document.createElement('data-table');

  (tableElement as any).columns = columns;
  (tableElement as any).rows = rows;
  (tableElement as any).rowActions = options.rowActions ?? true;
  (tableElement as any).searchable = options.searchable ?? true;
  (tableElement as any).sortable = options.sortable ?? true;
  (tableElement as any).paginated = options.paginated ?? true;

  if (options.rowsPerPage) {
    (tableElement as any).rowsPerPage = options.rowsPerPage;
  }

  return tableElement;
}

/**
 * Handle action menu clicks
 * @param action - The action object with action method name
 * @param resource - The resource object
 */
export function handleActionClick(action: any, resource: any): void {
  const actionMethod = action.action;
  if (resource && actionMethod && typeof resource[actionMethod] === 'function') {
    resource[actionMethod]();
  }
}

/**
 * Setup action click event listener on a table element
 * @param tableElement - The table element
 * @param handler - Optional custom handler, defaults to handleActionClick
 */
export function setupActionListener(
  tableElement: HTMLElement,
  handler: (action: any, resource: any) => void = handleActionClick
): void {
  tableElement.addEventListener('action-click', ((event: CustomEvent) => {
    const { action, resource } = event.detail;
    handler(action, resource);
  }) as EventListener);
}
