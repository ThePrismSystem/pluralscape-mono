import { AUDIT_RETENTION } from "@pluralscape/types";
import { AuditLogQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { getDb } from "../../lib/db.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { queryAuditLog } from "../../services/audit-log-query.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

const MS_PER_DAY = 86_400_000;
const MAX_RANGE_MS = AUDIT_RETENTION.maxQueryRangeDays * MS_PER_DAY;
const DEFAULT_RANGE_MS = MAX_RANGE_MS;

export const auditLogRoute = new Hono<AuthEnv>();

auditLogRoute.use("*", createCategoryRateLimiter("authLight"));

auditLogRoute.get("/", async (c) => {
  const auth = c.get("auth");

  const parsed = AuditLogQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters");
  }

  const now = Date.now();
  const to = parsed.data.to ?? now;
  const from = parsed.data.from ?? to - DEFAULT_RANGE_MS;

  if (to < from) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "'to' must be >= 'from'");
  }

  if (to - from > MAX_RANGE_MS) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      `Query range cannot exceed ${String(AUDIT_RETENTION.maxQueryRangeDays)} days`,
    );
  }

  const db = await getDb();
  const result = await queryAuditLog(db, auth.accountId, {
    eventType: parsed.data.event_type,
    from,
    to,
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
  });

  return c.json(result);
});
