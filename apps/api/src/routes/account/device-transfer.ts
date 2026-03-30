import { TRANSFER_TIMEOUT_MS } from "@pluralscape/crypto";
import { MS_PER_HOUR } from "@pluralscape/types";
import { Hono } from "hono";

import {
  HTTP_BAD_REQUEST,
  HTTP_CREATED,
  HTTP_FORBIDDEN,
  HTTP_NO_CONTENT,
  HTTP_NOT_FOUND,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_UNAUTHORIZED,
} from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createRateLimiter } from "../../middleware/rate-limit.js";
import {
  KeyDerivationUnavailableError,
  TransferCodeError,
  TransferExpiredError,
  TransferNotFoundError,
  TransferSessionMismatchError,
  TransferValidationError,
  approveTransfer,
  completeTransfer,
  initiateTransfer,
} from "../../services/device-transfer.service.js";

import {
  MAX_TRANSFER_CODE_ATTEMPTS,
  TRANSFER_INITIATION_LIMIT,
} from "./device-transfer.constants.js";
import {
  completeTransferBodySchema,
  initiateTransferBodySchema,
} from "./device-transfer.schema.js";

import type { AuthEnv } from "../../lib/auth-context.js";
import type { Context } from "hono";

/** Extract accountId from an authenticated context for rate-limit keying. */
const extractAccountId = (c: Context): string => (c.get("auth") as { accountId: string }).accountId;

export const deviceTransferRoute = new Hono<AuthEnv>();

// Account-keyed rate limiter for transfer initiation
deviceTransferRoute.use(
  "/",
  createRateLimiter({
    limit: TRANSFER_INITIATION_LIMIT,
    windowMs: MS_PER_HOUR,
    keyPrefix: "deviceTransfer:initiate",
    keyExtractor: extractAccountId,
  }),
);

// POST / — Initiate a device transfer
deviceTransferRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const body = await parseJsonBody(c);
  const audit = createAuditWriter(c, auth);

  const parseResult = initiateTransferBodySchema.safeParse(body);
  if (!parseResult.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parseResult.error.issues,
    );
  }

  try {
    const result = await initiateTransfer(
      db,
      auth.accountId,
      auth.sessionId,
      parseResult.data,
      audit,
    );
    return c.json(result, HTTP_CREATED);
  } catch (error: unknown) {
    if (error instanceof TransferValidationError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
});

// Per-transfer rate limiter for approval
deviceTransferRoute.use(
  "/:id/approve",
  createRateLimiter({
    limit: TRANSFER_INITIATION_LIMIT,
    windowMs: MS_PER_HOUR,
    keyPrefix: "deviceTransfer:approve",
    keyExtractor: extractAccountId,
  }),
);

// POST /:id/approve — Approve a pending device transfer (source device only)
deviceTransferRoute.post("/:id/approve", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const audit = createAuditWriter(c, auth);
  const transferId = c.req.param("id");

  try {
    await approveTransfer(db, transferId, auth.accountId, auth.sessionId, audit);
    return c.body(null, HTTP_NO_CONTENT);
  } catch (error: unknown) {
    if (error instanceof TransferNotFoundError) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", error.message);
    }
    if (error instanceof TransferSessionMismatchError) {
      throw new ApiHttpError(HTTP_FORBIDDEN, "FORBIDDEN", error.message);
    }
    throw error;
  }
});

// Per-transfer rate limiter for completion (prevents brute-forcing codes)
deviceTransferRoute.use(
  "/:id/complete",
  createRateLimiter({
    limit: MAX_TRANSFER_CODE_ATTEMPTS,
    windowMs: TRANSFER_TIMEOUT_MS,
    keyPrefix: "deviceTransfer:complete",
    keyExtractor: (c) => c.req.param("id") ?? extractAccountId(c),
  }),
);

// POST /:id/complete — Complete a device transfer
deviceTransferRoute.post("/:id/complete", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const body = await parseJsonBody(c);
  const audit = createAuditWriter(c, auth);
  const transferId = c.req.param("id");

  const parseResult = completeTransferBodySchema.safeParse(body);
  if (!parseResult.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parseResult.error.issues,
    );
  }

  try {
    const result = await completeTransfer(
      db,
      transferId,
      auth.accountId,
      auth.sessionId,
      parseResult.data.code,
      audit,
    );
    return c.json(result);
  } catch (error: unknown) {
    if (error instanceof TransferNotFoundError) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", error.message);
    }
    if (error instanceof TransferCodeError || error instanceof TransferExpiredError) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", error.message);
    }
    if (error instanceof TransferValidationError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof KeyDerivationUnavailableError) {
      throw new ApiHttpError(HTTP_SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", error.message);
    }
    throw error;
  }
});
