/**
 * Debounce delay (ms) before a typing user's query is executed against the
 * FTS5 index. ~300 ms tracks the median fast-typing inter-keystroke
 * interval — short enough to feel responsive, long enough that we don't
 * fire a query for every keystroke when someone is mid-word.
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Maximum results returned per entity type per FTS5 query. The UI groups
 * results by entity type, so 20 per group keeps the page-size manageable
 * while leaving headroom for a "show more" interaction; the underlying
 * SQLite scan is O(matches), not O(limit), so the cap mostly affects
 * memory and rendering cost.
 */
export const SEARCH_RESULTS_LIMIT = 20;
