/**
 * Shared HTTP status code constants.
 * Domain: all API routes, middleware, and service layers.
 */

/** HTTP 200 OK. */
export const HTTP_OK = 200;

/** HTTP 201 Created. */
export const HTTP_CREATED = 201;

/** HTTP 204 No Content — successful operation with no response body. */
export const HTTP_NO_CONTENT = 204;

/** HTTP 304 Not Modified — conditional request matched. */
export const HTTP_NOT_MODIFIED = 304;

/** HTTP 400 Bad Request. */
export const HTTP_BAD_REQUEST = 400;

/** HTTP 401 Unauthorized. */
export const HTTP_UNAUTHORIZED = 401;

/** HTTP 403 Forbidden. */
export const HTTP_FORBIDDEN = 403;

/** HTTP 404 Not Found. */
export const HTTP_NOT_FOUND = 404;

/** HTTP 409 Conflict. */
export const HTTP_CONFLICT = 409;

/** HTTP 413 Content Too Large — request body exceeds size limit. */
export const HTTP_CONTENT_TOO_LARGE = 413;

/** HTTP 429 Too Many Requests — rate limit exceeded. */
export const HTTP_TOO_MANY_REQUESTS = 429;

/** HTTP 500 Internal Server Error — unexpected server failure. */
export const HTTP_INTERNAL_SERVER_ERROR = 500;

/** HTTP 503 Service Unavailable — a downstream service is temporarily unavailable. */
export const HTTP_SERVICE_UNAVAILABLE = 503;
