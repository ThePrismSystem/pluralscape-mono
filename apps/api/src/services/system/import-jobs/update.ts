import { importJobs } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateImportJobBodySchema } from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { parseErrorLog, toImportJobResult } from "./internal.js";

import type { ImportJobResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { ImportError, ImportJobId, ImportJobStatus, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const TERMINAL_STATUSES: ReadonlySet<ImportJobStatus> = new Set(["completed", "failed"]);

/** Allowed status transitions for an import job.
 *  - `pending`: initial state; can move forward or fail.
 *  - `validating`: pre-flight checks; can proceed or fail.
 *  - `importing`: active work; self-loop for progress, terminal on success/failure.
 *  - `failed`: resumable only if the last error is fatal+recoverable.
 *  - `completed`: fully terminal.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<ImportJobStatus, readonly ImportJobStatus[]>> = {
  pending: ["pending", "validating", "importing", "failed"],
  validating: ["validating", "importing", "failed"],
  importing: ["importing", "completed", "failed"],
  failed: ["validating", "importing"],
  completed: [],
};

function isResumableFromFailed(errorLog: readonly ImportError[] | null): boolean {
  if (!errorLog || errorLog.length === 0) return false;
  const last = errorLog[errorLog.length - 1];
  if (!last) return false;
  return last.fatal && last.recoverable;
}

function pickAuditEventType(
  from: ImportJobStatus,
  to: ImportJobStatus,
): "import-job.updated" | "import-job.completed" | "import-job.failed" {
  if (from !== to && to === "completed") return "import-job.completed";
  if (from !== to && to === "failed") return "import-job.failed";
  return "import-job.updated";
}

export async function updateImportJob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  id: ImportJobId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ImportJobResult> {
  assertSystemOwnership(systemId, auth);
  const parseResult = UpdateImportJobBodySchema.safeParse(params);
  if (!parseResult.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid request body", {
      issues: parseResult.error.issues,
    });
  }
  const parsed = parseResult.data;

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // SELECT ... FOR UPDATE locks the row for the duration of the transaction
    // so two concurrent state-machine transitions cannot both pass the guard.
    // Without this, READ COMMITTED isolation would allow a double-resume:
    // both callers see `status = "failed"`, both check isResumableFromFailed,
    // both commit the same transition.
    const [current] = await tx
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.id, id), eq(importJobs.systemId, systemId)))
      .for("update")
      .limit(1);

    if (!current) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Import job not found");
    }

    // State machine enforcement.
    //
    // Note: a same-state write (e.g., `failed → failed` to append an error
    // entry) is NOT blocked by this guard — the check only fires when the
    // status actually changes. That's intentional: workers may append new
    // error entries to an already-failed job without triggering the
    // resumability check, and progress bumps on `importing → importing`
    // are the normal hot path.
    if (parsed.status !== undefined && parsed.status !== current.status) {
      const allowed = ALLOWED_TRANSITIONS[current.status];
      if (!allowed.includes(parsed.status)) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "INVALID_STATE",
          `Illegal transition from ${current.status} to ${parsed.status}`,
        );
      }
      // failed → importing|validating: require last error to be fatal + recoverable
      if (current.status === "failed") {
        const currentErrorLog = parseErrorLog(current.errorLog);
        if (!isResumableFromFailed(currentErrorLog)) {
          throw new ApiHttpError(
            HTTP_CONFLICT,
            "INVALID_STATE",
            `Cannot resume ${current.status} → ${parsed.status}: last error is not recoverable`,
          );
        }
      }
    }

    const updates: Partial<typeof importJobs.$inferInsert> = { updatedAt: timestamp };
    const terminalTransition =
      parsed.status !== undefined &&
      TERMINAL_STATUSES.has(parsed.status) &&
      parsed.status !== current.status;
    const nonTerminalReentry =
      parsed.status !== undefined &&
      !TERMINAL_STATUSES.has(parsed.status) &&
      TERMINAL_STATUSES.has(current.status);

    if (parsed.status !== undefined) updates.status = parsed.status;
    if (parsed.progressPercent !== undefined) updates.progressPercent = parsed.progressPercent;
    if (parsed.warningCount !== undefined) updates.warningCount = parsed.warningCount;
    if (parsed.chunksTotal !== undefined) updates.chunksTotal = parsed.chunksTotal;
    if (parsed.chunksCompleted !== undefined) updates.chunksCompleted = parsed.chunksCompleted;
    if (parsed.errorLog !== undefined) {
      updates.errorLog = parsed.errorLog as readonly ImportError[] | null;
    }
    if (parsed.checkpointState !== undefined) {
      updates.checkpointState = parsed.checkpointState;
    }

    if (terminalTransition) {
      updates.completedAt = timestamp;
    } else if (nonTerminalReentry) {
      updates.completedAt = null;
    }

    const [row] = await tx
      .update(importJobs)
      .set(updates)
      .where(and(eq(importJobs.id, id), eq(importJobs.systemId, systemId)))
      .returning();

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Import job not found");
    }

    const eventType = pickAuditEventType(current.status, row.status);
    await audit(tx, {
      eventType,
      actor: { kind: "account", id: auth.accountId },
      detail: `Import job ${id} (${current.status} → ${row.status})`,
      systemId,
    });

    return toImportJobResult(row);
  });
}
