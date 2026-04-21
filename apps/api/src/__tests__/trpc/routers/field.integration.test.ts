import { describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. Same block as the
// canonical member router integration test — keep BEFORE any module-level
// import that could transitively pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

import { createFieldDefinition } from "../../../services/field-definition/create.js";
import { clearFieldDefCache } from "../../../services/field-definition/internal.js";
import { fieldRouter } from "../../../trpc/routers/field.js";
import { noopAudit, testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  seedBucket,
  seedMember,
  setupRouterFixture,
} from "../integration-helpers.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const INITIAL_DEFINITION_VERSION = 1;

/**
 * Defaults to a `text` field (non-required, sortOrder 0) — the happy-path
 * shape the router tests exercise.
 */
async function seedFieldDefinition(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<FieldDefinitionId> {
  const result = await createFieldDefinition(
    db,
    systemId,
    {
      fieldType: "text",
      required: false,
      sortOrder: 0,
      encryptedData: testEncryptedDataBase64(),
    },
    auth,
    noopAudit,
  );
  return result.id;
}

describe("field router integration", () => {
  // The field-definition service memoizes list results at module scope; if
  // we don't clear between tests, a `list` from a prior test's tenant can
  // bleed through after `truncateAll` wipes the rows.
  const fixture = setupRouterFixture(
    { field: fieldRouter },
    {
      extraAfterEach: () => {
        clearFieldDefCache();
      },
    },
  );

  describe("field.definition.create", () => {
    it("creates a field definition belonging to the caller's system", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.field.definition.create({
        systemId: primary.systemId,
        fieldType: "text",
        required: false,
        sortOrder: 0,
        encryptedData: testEncryptedDataBase64(),
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^fld_/);
    });
  });

  describe("field.definition.get", () => {
    it("returns a field definition by id", async () => {
      const primary = fixture.getPrimary();
      const fieldDefinitionId = await seedFieldDefinition(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.field.definition.get({
        systemId: primary.systemId,
        fieldDefinitionId,
      });
      expect(result.id).toBe(fieldDefinitionId);
    });
  });

  describe("field.definition.list", () => {
    it("returns field definitions of the caller's system", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      await seedFieldDefinition(db, primary.systemId, primary.auth);
      await seedFieldDefinition(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.field.definition.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("field.definition.update", () => {
    it("updates a field definition's encrypted data", async () => {
      const primary = fixture.getPrimary();
      const fieldDefinitionId = await seedFieldDefinition(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.field.definition.update({
        systemId: primary.systemId,
        fieldDefinitionId,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_DEFINITION_VERSION,
      });
      expect(result.id).toBe(fieldDefinitionId);
    });
  });

  describe("field.definition.archive", () => {
    it("archives a field definition", async () => {
      const primary = fixture.getPrimary();
      const fieldDefinitionId = await seedFieldDefinition(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.field.definition.archive({
        systemId: primary.systemId,
        fieldDefinitionId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("field.definition.restore", () => {
    it("restores an archived field definition", async () => {
      const primary = fixture.getPrimary();
      const fieldDefinitionId = await seedFieldDefinition(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      await caller.field.definition.archive({
        systemId: primary.systemId,
        fieldDefinitionId,
      });
      const restored = await caller.field.definition.restore({
        systemId: primary.systemId,
        fieldDefinitionId,
      });
      expect(restored.id).toBe(fieldDefinitionId);
    });
  });

  describe("field.definition.delete", () => {
    it("deletes a field definition", async () => {
      const primary = fixture.getPrimary();
      const fieldDefinitionId = await seedFieldDefinition(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.field.definition.delete({
        systemId: primary.systemId,
        fieldDefinitionId,
      });
      expect(result.success).toBe(true);
    });
  });

  // Every value procedure needs both a field definition and an owner entity;
  // we use members as owners because the shared `seedMember` helper already
  // exists. The discriminated-union owner schema accepts "group" and
  // "structureEntity" too, but the routing logic is identical.

  describe("field.value.set", () => {
    it("sets a field value for a member owner", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const fieldDefinitionId = await seedFieldDefinition(db, primary.systemId, primary.auth);
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.field.value.set({
        systemId: primary.systemId,
        fieldDefinitionId,
        owner: { kind: "member", id: memberId },
        encryptedData: testEncryptedDataBase64(),
      });
      expect(result.fieldDefinitionId).toBe(fieldDefinitionId);
      expect(result.memberId).toBe(memberId);
    });
  });

  describe("field.value.list", () => {
    it("returns field values attached to a member owner", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const fieldDefinitionId = await seedFieldDefinition(db, primary.systemId, primary.auth);
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      await caller.field.value.set({
        systemId: primary.systemId,
        fieldDefinitionId,
        owner: { kind: "member", id: memberId },
        encryptedData: testEncryptedDataBase64(),
      });
      // listFieldValuesForOwner returns a bare array — not a paginated result.
      const result = await caller.field.value.list({
        systemId: primary.systemId,
        owner: { kind: "member", id: memberId },
      });
      expect(result.length).toBe(1);
      expect(result[0]?.fieldDefinitionId).toBe(fieldDefinitionId);
    });
  });

  describe("field.value.remove", () => {
    it("removes a field value from a member owner", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const fieldDefinitionId = await seedFieldDefinition(db, primary.systemId, primary.auth);
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      await caller.field.value.set({
        systemId: primary.systemId,
        fieldDefinitionId,
        owner: { kind: "member", id: memberId },
        encryptedData: testEncryptedDataBase64(),
      });
      const result = await caller.field.value.remove({
        systemId: primary.systemId,
        fieldDefinitionId,
        owner: { kind: "member", id: memberId },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("field.bucketVisibility.set", () => {
    it("grants a bucket visibility over a field definition", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const fieldDefinitionId = await seedFieldDefinition(db, primary.systemId, primary.auth);
      const bucketId = await seedBucket(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.field.bucketVisibility.set({
        systemId: primary.systemId,
        fieldDefinitionId,
        bucketId,
      });
      expect(result.fieldDefinitionId).toBe(fieldDefinitionId);
      expect(result.bucketId).toBe(bucketId);
    });
  });

  describe("field.bucketVisibility.remove", () => {
    it("revokes a previously granted bucket visibility", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const fieldDefinitionId = await seedFieldDefinition(db, primary.systemId, primary.auth);
      const bucketId = await seedBucket(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      await caller.field.bucketVisibility.set({
        systemId: primary.systemId,
        fieldDefinitionId,
        bucketId,
      });
      const result = await caller.field.bucketVisibility.remove({
        systemId: primary.systemId,
        fieldDefinitionId,
        bucketId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("field.bucketVisibility.list", () => {
    it("returns bucket visibility entries for a field definition", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const fieldDefinitionId = await seedFieldDefinition(db, primary.systemId, primary.auth);
      const bucketId = await seedBucket(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      await caller.field.bucketVisibility.set({
        systemId: primary.systemId,
        fieldDefinitionId,
        bucketId,
      });
      const result = await caller.field.bucketVisibility.list({
        systemId: primary.systemId,
        fieldDefinitionId,
      });
      expect(result.length).toBe(1);
      expect(result[0]?.bucketId).toBe(bucketId);
    });
  });

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(null);
      await expectAuthRequired(caller.field.definition.list({ systemId: primary.systemId }));
    });
  });

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's field definition", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const otherFieldId = await seedFieldDefinition(
        fixture.getCtx().db,
        other.systemId,
        other.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      await expectTenantDenied(
        caller.field.definition.get({
          systemId: other.systemId,
          fieldDefinitionId: otherFieldId,
        }),
      );
    });
  });
});
