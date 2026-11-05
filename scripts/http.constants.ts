/** HTTP statuses the seed and Crowdin scripts branch on. */
export const HTTP_NO_CONTENT = 204;
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_FORBIDDEN = 403;
export const HTTP_NOT_FOUND = 404;
export const HTTP_METHOD_NOT_ALLOWED = 405;
export const HTTP_CONFLICT = 409;
export const HTTP_TOO_MANY_REQUESTS = 429;

/** Lowest server-error status. The seed clients retry at or above this. */
export const HTTP_SERVER_ERROR_MIN = 500;

/** Characters of a response body to keep in an error message. */
export const ERROR_BODY_PREVIEW_CHARS = 200;
