import { brandId } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { buildAccountEmailChangeIdempotencyKey } from "../../routes/account/account.constants.js";
import { enqueueAccountEmailChangedNotification } from "../../services/account/notifications.js";

import type { AuditWriteParams, AuditWriter } from "../../lib/audit-writer.js";
import type { JobEnqueueParams, JobQueue } from "@pluralscape/queue";
import type { AccountId, JobDefinition } from "@pluralscape/types";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Mocks ────────────────────────────────────────────────────────────
// The helper does not touch the database directly — it only hands `db`
// through to the AuditWriter. But account.service.ts's top-of-file imports
// pull in crypto and schema modules; mocking them keeps the unit-test
// import graph light and deterministic, matching account.service.test.ts.

vi.mock("@pluralscape/crypto", () => ({
  AEAD_KEY_BYTES: 32,
  AUTH_KEY_HASH_BYTES: 32,
  PWHASH_SALT_BYTES: 16,
  AEAD_NONCE_BYTES: 24,
  AEAD_TAG_BYTES: 16,
  assertAeadNonce: () => undefined,
  assertSignPublicKey: () => undefined,
  assertSignature: () => undefined,
  assertAuthKey: vi.fn(),
  assertAuthKeyHash: vi.fn(),
  getSodium: () => ({
    randomBytes: (n: number) => new Uint8Array(n),
  }),
  hashAuthKey: () => new Uint8Array(32),
  verifyAuthKey: () => true,
  verify: vi.fn().mockReturnValue(true),
  generateSalt: () => new Uint8Array(16),
  generateChallengeNonce: () => new Uint8Array(32),
  generateMasterKey: () => new Uint8Array(32),
  wrapMasterKey: () => ({
    ciphertext: new Uint8Array(48),
    nonce: new Uint8Array(24),
  }),
  unwrapMasterKey: () => new Uint8Array(32),
  serializePublicKey: () => "base64-encoded-key",
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ── Test fixtures ────────────────────────────────────────────────────

/**
 * A minimally-stubbed `JobQueue`. Only `enqueue` is exercised by the helper;
 * every other method is a no-op that throws if accidentally invoked. Using a
 * Proxy to build the stub keeps the test file free of dozens of `() => { ... }`
 * placeholders while still satisfying the full `JobQueue` contract at
 * compile time.
 */
interface FakeQueue extends JobQueue {
  readonly enqueue: ReturnType<typeof vi.fn<(params: JobEnqueueParams) => Promise<JobDefinition>>>;
}

function makeFakeQueue(impl: (params: JobEnqueueParams) => Promise<JobDefinition>): FakeQueue {
  const enqueue = vi.fn(impl);
  const base = { enqueue };
  return new Proxy(base, {
    get(target, prop): unknown {
      if (prop === "enqueue") return target.enqueue;
      return () => {
        throw new Error(`FakeQueue.${String(prop)} called unexpectedly`);
      };
    },
  }) as FakeQueue;
}

/** A do-nothing fake db used only to satisfy the AuditWriter signature. */
const fakeDb: PostgresJsDatabase = {} as PostgresJsDatabase;

const ACCOUNT_ID: AccountId = brandId<AccountId>("acct_test");

function isEmailSend(arg: JobEnqueueParams): arg is JobEnqueueParams<"email-send"> {
  return arg.type === "email-send";
}

function expectEmailSendArg(arg: JobEnqueueParams | undefined): JobEnqueueParams<"email-send"> {
  if (!arg || !isEmailSend(arg)) {
    throw new Error("expected an email-send enqueue call");
  }
  return arg;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("enqueueAccountEmailChangedNotification", () => {
  it("is a no-op when queue is null", async () => {
    const audit: AuditWriter = vi.fn<AuditWriter>(() => Promise.resolve());
    await enqueueAccountEmailChangedNotification(null, audit, fakeDb, {
      accountId: ACCOUNT_ID,
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      version: 3,
      ipAddress: null,
    });
    expect(audit).not.toHaveBeenCalled();
  });

  it("is a no-op when oldEmail is null", async () => {
    const queue = makeFakeQueue(() => {
      throw new Error("should not be called");
    });
    const audit: AuditWriter = vi.fn<AuditWriter>(() => Promise.resolve());
    await enqueueAccountEmailChangedNotification(queue, audit, fakeDb, {
      accountId: ACCOUNT_ID,
      oldEmail: null,
      newEmail: "new@example.com",
      version: 3,
      ipAddress: null,
    });
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("enqueues with versioned idempotency key, recipientOverride, and ISO timestamp", async () => {
    const queue = makeFakeQueue(() => Promise.resolve({} as JobDefinition));
    const audit: AuditWriter = vi.fn<AuditWriter>(() => Promise.resolve());
    await enqueueAccountEmailChangedNotification(queue, audit, fakeDb, {
      accountId: ACCOUNT_ID,
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      version: 7,
      ipAddress: "1.2.3.4",
    });

    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    const arg = expectEmailSendArg(queue.enqueue.mock.calls[0]?.[0]);
    expect(arg.idempotencyKey).toBe(buildAccountEmailChangeIdempotencyKey(ACCOUNT_ID, 7));
    expect(arg.payload.recipientOverride).toBe("old@example.com");
    expect(arg.payload.vars).toMatchObject({
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      ipAddress: "1.2.3.4",
    });
    const { timestamp } = arg.payload.vars;
    expect(typeof timestamp).toBe("string");
    // ISO-8601 round-trip: `new Date(s).toISOString() === s` — cheap structural check.
    expect(new Date(timestamp as string).toISOString()).toBe(timestamp);
    expect(audit).not.toHaveBeenCalled();
  });

  it("omits ipAddress from vars when null", async () => {
    const queue = makeFakeQueue(() => Promise.resolve({} as JobDefinition));
    const audit: AuditWriter = vi.fn<AuditWriter>(() => Promise.resolve());
    await enqueueAccountEmailChangedNotification(queue, audit, fakeDb, {
      accountId: ACCOUNT_ID,
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      version: 2,
      ipAddress: null,
    });
    const arg = expectEmailSendArg(queue.enqueue.mock.calls[0]?.[0]);
    expect(arg.payload.vars).not.toHaveProperty("ipAddress");
  });

  it("writes audit event when enqueue rejects", async () => {
    const queue = makeFakeQueue(() => Promise.reject(new Error("redis down")));
    const auditCalls: AuditWriteParams[] = [];
    const audit: AuditWriter = (
      _db: PgDatabase<PgQueryResultHKT>,
      params: AuditWriteParams,
    ): Promise<void> => {
      auditCalls.push(params);
      return Promise.resolve();
    };

    await enqueueAccountEmailChangedNotification(queue, audit, fakeDb, {
      accountId: ACCOUNT_ID,
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      version: 7,
      ipAddress: null,
    });

    expect(auditCalls).toHaveLength(1);
    const [entry] = auditCalls;
    if (!entry) throw new Error("expected audit entry");
    expect(entry.eventType).toBe("auth.email-change-notification-enqueue-failed");
    expect(entry.actor).toEqual({ kind: "account", id: ACCOUNT_ID });
    expect(entry.detail).toContain("redis down");
  });

  it("does not throw when audit write also fails", async () => {
    const queue = makeFakeQueue(() => Promise.reject(new Error("redis down")));
    const audit: AuditWriter = () => Promise.reject(new Error("pg down"));

    await expect(
      enqueueAccountEmailChangedNotification(queue, audit, fakeDb, {
        accountId: ACCOUNT_ID,
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        version: 7,
        ipAddress: null,
      }),
    ).resolves.toBeUndefined();
  });
});
