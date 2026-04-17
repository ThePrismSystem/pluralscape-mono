import { PGlite } from "@electric-sql/pglite";
import { initSodium } from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import { createPgAuthTables, pgInsertAccount } from "@pluralscape/db/test-helpers/pg-helpers";
import { InMemoryEmailAdapter } from "@pluralscape/email/testing";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/** 64-hex-char (32-byte) test key for email encryption. */
const TEST_ENCRYPTION_KEY = vi.hoisted(() => "ab".repeat(32));

vi.mock("../../env.js", async () => {
  const actual = await vi.importActual<typeof import("../../env.js")>("../../env.js");
  return {
    env: {
      ...actual.env,
      EMAIL_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
    },
  };
});

import { encryptEmail } from "../../lib/email-encrypt.js";
import { _resetEmailAdapterForTesting, setEmailAdapterForTesting } from "../../lib/email.js";
import { processEmailJob } from "../../services/email-worker.js";
import { asDb } from "../helpers/integration-setup.js";

import type { AccountId, JobPayloadMap } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

describe("email-worker (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let emailAdapter: InMemoryEmailAdapter;

  beforeAll(async () => {
    await initSodium();
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgAuthTables(client);
    accountId = brandId<AccountId>(await pgInsertAccount(db));
    emailAdapter = new InMemoryEmailAdapter();
    setEmailAdapterForTesting(emailAdapter);
  });

  afterAll(async () => {
    _resetEmailAdapterForTesting();
    await client.close();
  });

  afterEach(async () => {
    emailAdapter.clear();
    await db
      .update(schema.accounts)
      .set({ encryptedEmail: null })
      .where(eq(schema.accounts.id, accountId));
  });

  function makePayload(
    overrides?: Partial<JobPayloadMap["email-send"]>,
  ): JobPayloadMap["email-send"] {
    return {
      accountId,
      template: "recovery-key-regenerated",
      vars: {
        timestamp: "2026-03-29T00:00:00Z",
        deviceInfo: "Integration Test Browser",
      },
      recipientOverride: null,
      ...overrides,
    };
  }

  it("skips sending when account has no encrypted email", async () => {
    // Default test account has no encrypted_email
    await processEmailJob(asDb(db), makePayload());

    expect(emailAdapter.sentCount).toBe(0);
  });

  it("skips sending when account does not exist", async () => {
    const nonexistentId = brandId<AccountId>(`acc_${crypto.randomUUID()}`);

    await processEmailJob(asDb(db), makePayload({ accountId: nonexistentId }));

    expect(emailAdapter.sentCount).toBe(0);
  });

  it("sends email when account has encrypted email", async () => {
    const encrypted = encryptEmail("test@example.com");
    await db
      .update(schema.accounts)
      .set({ encryptedEmail: encrypted })
      .where(eq(schema.accounts.id, accountId));

    await processEmailJob(asDb(db), makePayload());

    expect(emailAdapter.sentCount).toBe(1);
    expect(emailAdapter.lastSent?.to).toBe("test@example.com");
    expect(emailAdapter.lastSent?.subject).toBeTruthy();
    expect(emailAdapter.lastSent?.html).toBeTruthy();
    expect(emailAdapter.lastSent?.text).toBeTruthy();
  });

  it("renders correct template variables", async () => {
    const encrypted = encryptEmail("vars-test@example.com");
    await db
      .update(schema.accounts)
      .set({ encryptedEmail: encrypted })
      .where(eq(schema.accounts.id, accountId));

    await processEmailJob(
      asDb(db),
      makePayload({
        vars: {
          timestamp: "2026-01-15T12:00:00Z",
          deviceInfo: "Chrome on Windows",
        },
      }),
    );

    expect(emailAdapter.sentCount).toBe(1);
    const sent = emailAdapter.lastSent;
    expect(sent?.html).toContain("Chrome on Windows");
  });
});
