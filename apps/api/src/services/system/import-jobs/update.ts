import { importJobs } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { parseErrorLog, toImportJobResult } from "./internal.js";

import type { ImportJobResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  ImportCheckpointState,
  ImportError,
  ImportJobId,
  ImportJobStatus,
  ServerInternal,
  SystemId,
} from "@pluralscape/types";
import type { UpdateImportJobBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

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
  body: z.infer<typeof UpdateImportJobBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ImportJobResult> {
  assertSystemOwnership(systemId, auth);

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
    if (body.status !== undefined && body.status !== current.status) {
      const allowed = ALLOWED_TRANSITIONS[current.status];
      if (!allowed.includes(body.status)) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "INVALID_STATE",
          `Illegal transition from ${current.status} to ${body.status}`,
        );
      }
      // failed → importing|validating: require last error to be fatal + recoverable
      if (current.status === "failed") {
        const currentErrorLog = parseErrorLog(current.errorLog);
        if (!isResumableFromFailed(currentErrorLog)) {
          throw new ApiHttpError(
            HTTP_CONFLICT,
            "INVALID_STATE",
            `Cannot resume ${current.status} → ${body.status}: last error is not recoverable`,
          );
        }
      }
    }

    const updates: Partial<typeof importJobs.$inferInsert> = { updatedAt: timestamp };
    const terminalTransition =
      body.status !== undefined &&
      TERMINAL_STATUSES.has(body.status) &&
      body.status !== current.status;
    const nonTerminalReentry =
      body.status !== undefined &&
      !TERMINAL_STATUSES.has(body.status) &&
      TERMINAL_STATUSES.has(current.status);

    if (body.status !== undefined) updates.status = body.status;
    if (body.progressPercent !== undefined) updates.progressPercent = body.progressPercent;
    if (body.warningCount !== undefined) updates.warningCount = body.warningCount;
    if (body.chunksTotal !== undefined) updates.chunksTotal = body.chunksTotal;
    if (body.chunksCompleted !== undefined) updates.chunksCompleted = body.chunksCompleted;
    if (body.errorLog !== undefined) {
      updates.errorLog = body.errorLog as readonly ImportError[] | null;
    }
    if (body.checkpointState !== undefined) {
      updates.checkpointState =
        body.checkpointState as ServerInternal<ImportCheckpointState> | null;
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
