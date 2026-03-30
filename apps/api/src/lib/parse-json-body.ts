import { HTTP_BAD_REQUEST, HTTP_UNSUPPORTED_MEDIA_TYPE } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { Context } from "hono";

export async function parseJsonBody(c: Context): Promise<unknown> {
  const contentType = c.req.header("content-type");
  if (!contentType?.startsWith("application/json")) {
    throw new ApiHttpError(
      HTTP_UNSUPPORTED_MEDIA_TYPE,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json",
    );
  }

  try {
    return await c.req.json();
  } catch (cause: unknown) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body", { cause });
  }
}
