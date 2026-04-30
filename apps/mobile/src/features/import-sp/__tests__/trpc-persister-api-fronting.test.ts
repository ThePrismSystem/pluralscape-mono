/**
 * tRPC PersisterApi bridge tests — frontingSession, frontingComment, note.
 *
 * Companion files: trpc-persister-api-core.test.ts,
 *                  trpc-persister-api-comms.test.ts
 */

import { brandId } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { createTRPCPersisterApi } from "../trpc-persister-api.js";

import { makeMockClient } from "./helpers/trpc-mock-client.js";

import type { SystemId } from "@pluralscape/types";

const TEST_SYSTEM_ID = brandId<SystemId>("sys_bridge_test");

// ── frontingSession ─────────────────────────────────────────────────

describe("frontingSession", () => {
  it("create calls frontingSession.create with startTime", async () => {
    const client = makeMockClient();
    client.frontingSession.create.mutate.mockResolvedValue({ id: "fs_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.frontingSession.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_session",
      startTime: 1_700_000_000,
      memberId: null,
      customFrontId: null,
      structureEntityId: null,
    });

    expect(result).toEqual({ id: "fs_1", version: 1 });
    expect(client.frontingSession.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_session",
      startTime: 1_700_000_000,
      memberId: null,
      customFrontId: null,
      structureEntityId: null,
    });
  });

  it("update calls frontingSession.update with sessionId", async () => {
    const client = makeMockClient();
    client.frontingSession.update.mutate.mockResolvedValue({ id: "fs_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.frontingSession.update(TEST_SYSTEM_ID, "fs_1", {
      encryptedData: "enc_session_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "fs_1", version: 2 });
    expect(client.frontingSession.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      sessionId: "fs_1",
      encryptedData: "enc_session_v2",
      version: 1,
    });
  });
});

// ── frontingComment ─────────────────────────────────────────────────

describe("frontingComment", () => {
  it("create calls frontingComment.create", async () => {
    const client = makeMockClient();
    client.frontingComment.create.mutate.mockResolvedValue({ id: "fcom_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.frontingComment.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_comment",
      sessionId: "fs_1",
      memberId: null,
      customFrontId: null,
      structureEntityId: null,
    });

    expect(result).toEqual({ id: "fcom_1", version: 1 });
    expect(client.frontingComment.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      sessionId: "fs_1",
      encryptedData: "enc_comment",
    });
  });

  it("update calls frontingComment.update with commentId and sessionId", async () => {
    const client = makeMockClient();
    client.frontingComment.update.mutate.mockResolvedValue({ id: "fcom_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.frontingComment.update(TEST_SYSTEM_ID, "fcom_1", {
      encryptedData: "enc_comment_v2",
      version: 1,
      sessionId: "fs_real_session",
    });

    expect(result).toEqual({ id: "fcom_1", version: 2 });
    expect(client.frontingComment.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      sessionId: "fs_real_session",
      commentId: "fcom_1",
      encryptedData: "enc_comment_v2",
      version: 1,
    });
  });
});

// ── note ────────────────────────────────────────────────────────────

describe("note", () => {
  it("create calls note.create", async () => {
    const client = makeMockClient();
    client.note.create.mutate.mockResolvedValue({ id: "note_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.note.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_note",
      author: null,
    });

    expect(result).toEqual({ id: "note_1", version: 1 });
    expect(client.note.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_note",
      author: null,
    });
  });

  it("update calls note.update with noteId", async () => {
    const client = makeMockClient();
    client.note.update.mutate.mockResolvedValue({ id: "note_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.note.update(TEST_SYSTEM_ID, "note_1", {
      encryptedData: "enc_note_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "note_1", version: 2 });
    expect(client.note.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      noteId: "note_1",
      encryptedData: "enc_note_v2",
      version: 1,
    });
  });
});
