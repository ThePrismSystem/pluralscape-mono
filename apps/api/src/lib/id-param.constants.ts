/**
 * ID parameter validation constants.
 * Domain: route-level format guards for branded IDs.
 */

/** UUID v4 pattern (lowercase hex, 8-4-4-4-12). */
export const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
