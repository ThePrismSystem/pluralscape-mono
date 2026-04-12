import { classifyErrorDefault } from "@pluralscape/import-core";
import { APIError } from "pkapi.js";

import type { ClassifyContext } from "@pluralscape/import-core";
import type { ImportError } from "@pluralscape/types";

export function classifyPkError(thrown: unknown, ctx: ClassifyContext): ImportError {
  if (thrown instanceof APIError) {
    const status = thrown.status ?? "???";
    const message = thrown.message ?? `PK API error (${status})`;

    // Auth failures are fatal — no point retrying with the same credentials
    if (status === "401" || status === "403") {
      return { entityType: ctx.entityType, entityId: ctx.entityId, message, fatal: true };
    }

    // Rate limit, server errors, and 404 are non-fatal — may resolve on retry
    if (status === "429" || status === "404" || status.startsWith("5")) {
      return { entityType: ctx.entityType, entityId: ctx.entityId, message, fatal: false };
    }

    // Unknown API status — treat as fatal
    return { entityType: ctx.entityType, entityId: ctx.entityId, message, fatal: true };
  }

  return classifyErrorDefault(thrown, ctx);
}
