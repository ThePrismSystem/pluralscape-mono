import type { ServerSafe } from "@pluralscape/types";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Type-safe JSON response that only accepts ServerSafe-branded data. */
export function safeJson<T>(
  c: Context,
  data: ServerSafe<T>,
  status?: ContentfulStatusCode,
): Response {
  return c.json(data as T, status);
}
