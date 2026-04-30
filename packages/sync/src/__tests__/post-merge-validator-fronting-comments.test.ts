/**
 * Post-merge validator — fronting-comment author normalization tests.
 *
 * Covers:
 *   - normalizeFrontingCommentAuthors: authorless notification, valid-author no-op,
 *     multiple authorless, no-comments-field early return, customFrontId-only,
 *     structureEntityId-only, mixed valid/authorless
 *   - runAllValidations dispatch: frontingCommentAuthorIssues counter
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createFrontingDocument, createSystemCoreDocument } from "../factories/document-factory.js";
import { normalizeFrontingCommentAuthors, runAllValidations } from "../post-merge-validator.js";
import { EncryptedSyncSession } from "../sync-session.js";

import { makeKeys, s, setSodium } from "./helpers/validator-fixtures.js";
import { asFrontingCommentId, asSyncDocId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let keys: DocumentKeys;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
  setSodium(sodium);
});

// ── normalizeFrontingCommentAuthors ───────────────────────────────────

describe("PostMergeValidator: normalizeFrontingCommentAuthors", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("emits notification-only when all author fields are null", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-authorless"),
      sodium,
    });

    const commentId = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(commentId)] = {
        id: s(commentId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_placeholder"),
        customFrontId: null,
        structureEntityId: null,
        content: s("test comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    // Null out memberId to simulate CRDT merge artifact
    session.change((d) => {
      const target = d.comments[asFrontingCommentId(commentId)];
      if (target) target.memberId = null;
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.resolution).toBe("notification-only");
    expect(notifications[0]?.entityType).toBe("fronting-comment");
    expect(notifications[0]?.entityId).toBe(commentId);
    expect(notifications[0]?.fieldName).toBe("author");
  });

  it("returns no notifications when at least one author field is set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-valid-author"),
      sodium,
    });

    const commentId = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(commentId)] = {
        id: s(commentId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        customFrontId: null,
        structureEntityId: null,
        content: s("test comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(0);
  });

  it("detects multiple authorless comments in a single pass", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-multi-authorless"),
      sodium,
    });

    const id1 = `fc_${crypto.randomUUID()}`;
    const id2 = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(id1)] = {
        id: s(id1),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_tmp"),
        customFrontId: null,
        structureEntityId: null,
        content: s("comment 1"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.comments[asFrontingCommentId(id2)] = {
        id: s(id2),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_tmp"),
        customFrontId: null,
        structureEntityId: null,
        content: s("comment 2"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    session.change((d) => {
      const c1 = d.comments[asFrontingCommentId(id1)];
      const c2 = d.comments[asFrontingCommentId(id2)];
      if (c1) c1.memberId = null;
      if (c2) c2.memberId = null;
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(2);
    expect(notifications.every((n) => n.resolution === "notification-only")).toBe(true);
  });

  it("returns no notifications when document has no comments field", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-sysCore-no-comments"),
      sodium,
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(0);
  });

  it("returns no notifications when only customFrontId is set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-customfront-author"),
      sodium,
    });

    const commentId = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(commentId)] = {
        id: s(commentId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: null,
        customFrontId: s("cf_1"),
        structureEntityId: null,
        content: s("custom front comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(0);
  });

  it("returns no notifications when only structureEntityId is set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-entity-author"),
      sodium,
    });

    const commentId = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(commentId)] = {
        id: s(commentId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: null,
        customFrontId: null,
        structureEntityId: s("ste_1"),
        content: s("entity comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(0);
  });

  it("detects only authorless comments in a mixed set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-mixed-authors"),
      sodium,
    });

    const validMemberId = `fc_${crypto.randomUUID()}`;
    const validCustomFrontId = `fc_${crypto.randomUUID()}`;
    const authorlessId = `fc_${crypto.randomUUID()}`;

    session.change((d) => {
      d.comments[asFrontingCommentId(validMemberId)] = {
        id: s(validMemberId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        customFrontId: null,
        structureEntityId: null,
        content: s("member comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.comments[asFrontingCommentId(validCustomFrontId)] = {
        id: s(validCustomFrontId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: null,
        customFrontId: s("cf_1"),
        structureEntityId: null,
        content: s("custom front comment"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.comments[asFrontingCommentId(authorlessId)] = {
        id: s(authorlessId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_tmp"),
        customFrontId: null,
        structureEntityId: null,
        content: s("will become authorless"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    session.change((d) => {
      const target = d.comments[asFrontingCommentId(authorlessId)];
      if (target) target.memberId = null;
    });

    const { notifications, envelope } = normalizeFrontingCommentAuthors(session);

    expect(envelope).toBeNull();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.entityId).toBe(authorlessId);
  });
});

// ── runAllValidations: fronting-comment dispatch ──────────────────────

describe("runAllValidations: frontingCommentAuthor dispatch", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("counts frontingCommentAuthorIssues for authorless comments in fronting doc", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-run-comment-author"),
      sodium,
    });

    const commentId = `fc_${crypto.randomUUID()}`;
    session.change((d) => {
      d.comments[asFrontingCommentId(commentId)] = {
        id: s(commentId),
        frontingSessionId: s("fs_1"),
        systemId: s("sys_1"),
        memberId: s("mem_tmp"),
        customFrontId: null,
        structureEntityId: null,
        content: s("authorless after merge"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    session.change((d) => {
      const target = d.comments[asFrontingCommentId(commentId)];
      if (target) target.memberId = null;
    });

    const result = runAllValidations(session);

    expect(result.frontingCommentAuthorIssues).toBe(1);
    expect(result.notifications.some((n) => n.entityType === "fronting-comment")).toBe(true);
  });
});
