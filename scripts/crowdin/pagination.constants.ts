/** Page size used when listing Crowdin resources via paginated endpoints. */
export const LIST_PAGE_SIZE = 500;

/**
 * Hard cap on pagination loops. Guards against infinite loops if an endpoint
 * ever returns full pages indefinitely (e.g., an echoing mock). At 500 items
 * per page, 100 pages = 50,000 items — well above any Crowdin project size we
 * expect. Hitting this cap throws with context so operators can investigate.
 */
export const MAX_PAGES = 100;
