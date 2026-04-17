/**
 * Wire protocol shared between the main-thread OPFS driver proxy and the
 * Web Worker hosting wa-sqlite + OPFSCoopSyncVFS.
 *
 * All messages are structured-clone-safe. Uint8Array blobs ride natively.
 */

export type BindParam = number | string | bigint | Uint8Array | null;

export type Row = Record<string, BindParam>;

export type StmtHandle = number;

// ── Requests: main → worker ───────────────────────────────────────────

export type Req =
  | { id: number; kind: "init" }
  | { id: number; kind: "prepare"; sql: string }
  | { id: number; kind: "run"; stmt: StmtHandle; params: BindParam[] }
  | { id: number; kind: "all"; stmt: StmtHandle; params: BindParam[] }
  | { id: number; kind: "get"; stmt: StmtHandle; params: BindParam[] }
  | { id: number; kind: "exec"; sql: string }
  | { id: number; kind: "txn-begin" }
  | { id: number; kind: "txn-commit" }
  | { id: number; kind: "txn-rollback" }
  | { id: number; kind: "finalize"; stmt: StmtHandle }
  | { id: number; kind: "close" };

// ── Responses: worker → main ──────────────────────────────────────────

export type OkResult = undefined | Row[] | Row | StmtHandle;

export type ErrorPayload = { message: string; code?: number; name?: string };

export type Res =
  | { id: number; ok: true; result: OkResult }
  | { id: number; ok: false; error: ErrorPayload }
  | { id: -1; ok: false; panic: true; error: ErrorPayload };

/** Per-kind response payload type for typed dispatch in send<K>. */
type ResultMap = {
  init: undefined;
  prepare: StmtHandle;
  run: undefined;
  all: Row[];
  get: Row | undefined;
  exec: undefined;
  "txn-begin": undefined;
  "txn-commit": undefined;
  "txn-rollback": undefined;
  finalize: undefined;
  close: undefined;
};

export type ResultFor<K extends Req["kind"]> = ResultMap[K];

// ── Error classes ─────────────────────────────────────────────────────

export type OpfsErrorKind = "driver" | "unavailable" | "timeout" | "terminated";

export class OpfsDriverError extends Error {
  readonly kind: OpfsErrorKind = "driver";
  readonly code?: number;
  constructor(message: string, opts: { code?: number; name?: string; cause?: unknown } = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = opts.name ?? "OpfsDriverError";
    if (opts.code !== undefined) this.code = opts.code;
  }
}

export class OpfsDriverUnavailableError extends OpfsDriverError {
  readonly kind = "unavailable" as const;
  constructor(message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : {});
    this.name = "OpfsDriverUnavailableError";
  }
}

export class OpfsDriverTimeoutError extends OpfsDriverError {
  readonly kind = "timeout" as const;
  constructor(message: string) {
    super(message);
    this.name = "OpfsDriverTimeoutError";
  }
}

export class WorkerTerminatedError extends OpfsDriverError {
  readonly kind = "terminated" as const;
  constructor(message = "OPFS worker terminated while request was in flight") {
    super(message);
    this.name = "WorkerTerminatedError";
  }
}
