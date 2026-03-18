/**
 * Group-route constants.
 * Domain: group hierarchy.
 */

/**
 * Safety cap for ancestor walk during cycle detection.
 * Limits group nesting to 50 levels — sufficient for any practical
 * folder hierarchy while preventing runaway traversals from circular references.
 */
export const MAX_ANCESTOR_DEPTH = 50;
