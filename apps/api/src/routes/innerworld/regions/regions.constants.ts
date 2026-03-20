/**
 * Innerworld region pagination constants.
 * Domain: innerworld region list endpoints.
 */

/**
 * Default page size for region list queries.
 *
 * Most inner worlds have a modest number of regions. A default of 25
 * covers the typical case without requiring pagination in the UI.
 */
export const DEFAULT_REGION_LIMIT = 25;

/**
 * Maximum page size for region list queries.
 *
 * Aligns with the standard 100-item cap used across other list endpoints.
 * Region data includes encrypted spatial metadata, so larger pages would
 * increase decryption work on the client.
 */
export const MAX_REGION_LIMIT = 100;
