/**
 * tRPC-backed PersisterApi bridge tests — core entity groups.
 *
 * Covers: system, systemSettings, bucket, field, customFront, member, friend,
 *         frontingSession, frontingComment, note
 * Companion file: trpc-persister-api-comms.test.ts
 */

import { brandId } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { createTRPCPersisterApi } from "../trpc-persister-api.js";

import type { TRPCClientSubset } from "../trpc-persister-api.js";
import type { SystemId } from "@pluralscape/types";
import type { Mock } from "vitest";

// ── Helpers ─────────────────────────────────────────────────────────

const TEST_SYSTEM_ID = brandId<SystemId>("sys_bridge_test");

interface MockQuery<TInput, TOutput> {
  readonly query: Mock<(input: TInput) => Promise<TOutput>>;
}

interface MockMutation<TInput, TOutput> {
  readonly mutate: Mock<(input: TInput) => Promise<TOutput>>;
}

interface MockTRPCClient extends TRPCClientSubset {
  readonly system: {
    readonly get: MockQuery<
      Parameters<TRPCClientSubset["system"]["get"]["query"]>[0],
      Awaited<ReturnType<TRPCClientSubset["system"]["get"]["query"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["system"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["system"]["update"]["mutate"]>>
    >;
  };
  readonly systemSettings: {
    readonly settings: {
      readonly get: MockQuery<
        Parameters<TRPCClientSubset["systemSettings"]["settings"]["get"]["query"]>[0],
        Awaited<ReturnType<TRPCClientSubset["systemSettings"]["settings"]["get"]["query"]>>
      >;
      readonly update: MockMutation<
        Parameters<TRPCClientSubset["systemSettings"]["settings"]["update"]["mutate"]>[0],
        Awaited<ReturnType<TRPCClientSubset["systemSettings"]["settings"]["update"]["mutate"]>>
      >;
    };
  };
  readonly bucket: {
    readonly create: MockMutation<
      Parameters<TRPCClientSubset["bucket"]["create"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["bucket"]["create"]["mutate"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["bucket"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["bucket"]["update"]["mutate"]>>
    >;
  };
  readonly field: {
    readonly definition: {
      readonly create: MockMutation<
        Parameters<TRPCClientSubset["field"]["definition"]["create"]["mutate"]>[0],
        Awaited<ReturnType<TRPCClientSubset["field"]["definition"]["create"]["mutate"]>>
      >;
      readonly update: MockMutation<
        Parameters<TRPCClientSubset["field"]["definition"]["update"]["mutate"]>[0],
        Awaited<ReturnType<TRPCClientSubset["field"]["definition"]["update"]["mutate"]>>
      >;
    };
    readonly value: {
      readonly set: MockMutation<
        Parameters<TRPCClientSubset["field"]["value"]["set"]["mutate"]>[0],
        Awaited<ReturnType<TRPCClientSubset["field"]["value"]["set"]["mutate"]>>
      >;
    };
  };
  readonly customFront: {
    readonly create: MockMutation<
      Parameters<TRPCClientSubset["customFront"]["create"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["customFront"]["create"]["mutate"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["customFront"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["customFront"]["update"]["mutate"]>>
    >;
  };
  readonly member: {
    readonly create: MockMutation<
      Parameters<TRPCClientSubset["member"]["create"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["member"]["create"]["mutate"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["member"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["member"]["update"]["mutate"]>>
    >;
  };
  readonly frontingSession: {
    readonly create: MockMutation<
      Parameters<TRPCClientSubset["frontingSession"]["create"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["frontingSession"]["create"]["mutate"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["frontingSession"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["frontingSession"]["update"]["mutate"]>>
    >;
  };
  readonly frontingComment: {
    readonly create: MockMutation<
      Parameters<TRPCClientSubset["frontingComment"]["create"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["frontingComment"]["create"]["mutate"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["frontingComment"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["frontingComment"]["update"]["mutate"]>>
    >;
  };
  readonly note: {
    readonly create: MockMutation<
      Parameters<TRPCClientSubset["note"]["create"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["note"]["create"]["mutate"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["note"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["note"]["update"]["mutate"]>>
    >;
  };
  readonly poll: {
    readonly create: MockMutation<
      Parameters<TRPCClientSubset["poll"]["create"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["poll"]["create"]["mutate"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["poll"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["poll"]["update"]["mutate"]>>
    >;
    readonly castVote: MockMutation<
      Parameters<TRPCClientSubset["poll"]["castVote"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["poll"]["castVote"]["mutate"]>>
    >;
  };
  readonly channel: {
    readonly create: MockMutation<
      Parameters<TRPCClientSubset["channel"]["create"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["channel"]["create"]["mutate"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["channel"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["channel"]["update"]["mutate"]>>
    >;
  };
  readonly message: {
    readonly create: MockMutation<
      Parameters<TRPCClientSubset["message"]["create"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["message"]["create"]["mutate"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["message"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["message"]["update"]["mutate"]>>
    >;
  };
  readonly boardMessage: {
    readonly create: MockMutation<
      Parameters<TRPCClientSubset["boardMessage"]["create"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["boardMessage"]["create"]["mutate"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["boardMessage"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["boardMessage"]["update"]["mutate"]>>
    >;
  };
  readonly group: {
    readonly create: MockMutation<
      Parameters<TRPCClientSubset["group"]["create"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["group"]["create"]["mutate"]>>
    >;
    readonly update: MockMutation<
      Parameters<TRPCClientSubset["group"]["update"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["group"]["update"]["mutate"]>>
    >;
    readonly addMember: MockMutation<
      Parameters<TRPCClientSubset["group"]["addMember"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["group"]["addMember"]["mutate"]>>
    >;
  };
  readonly blob: {
    readonly createUploadUrl: MockMutation<
      Parameters<TRPCClientSubset["blob"]["createUploadUrl"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["blob"]["createUploadUrl"]["mutate"]>>
    >;
    readonly confirmUpload: MockMutation<
      Parameters<TRPCClientSubset["blob"]["confirmUpload"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["blob"]["confirmUpload"]["mutate"]>>
    >;
  };
  readonly importEntityRef: {
    readonly lookupBatch: MockMutation<
      Parameters<TRPCClientSubset["importEntityRef"]["lookupBatch"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["importEntityRef"]["lookupBatch"]["mutate"]>>
    >;
    readonly upsertBatch: MockMutation<
      Parameters<TRPCClientSubset["importEntityRef"]["upsertBatch"]["mutate"]>[0],
      Awaited<ReturnType<TRPCClientSubset["importEntityRef"]["upsertBatch"]["mutate"]>>
    >;
  };
}

function makeMockClient(): MockTRPCClient {
  return {
    system: {
      get: { query: vi.fn() },
      update: { mutate: vi.fn() },
    },
    systemSettings: {
      settings: {
        get: { query: vi.fn() },
        update: { mutate: vi.fn() },
      },
    },
    bucket: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
    },
    field: {
      definition: {
        create: { mutate: vi.fn() },
        update: { mutate: vi.fn() },
      },
      value: {
        set: { mutate: vi.fn() },
      },
    },
    customFront: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
    },
    member: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
    },
    frontingSession: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
    },
    frontingComment: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
    },
    note: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
    },
    poll: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      castVote: { mutate: vi.fn() },
    },
    channel: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
    },
    message: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
    },
    boardMessage: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
    },
    group: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      addMember: { mutate: vi.fn() },
    },
    blob: {
      createUploadUrl: { mutate: vi.fn() },
      confirmUpload: { mutate: vi.fn() },
    },
    importEntityRef: {
      lookupBatch: { mutate: vi.fn() },
      upsertBatch: { mutate: vi.fn() },
    },
  };
}

// ── system ──────────────────────────────────────────────────────────

describe("system", () => {
  it("getCurrentVersion queries system.get and extracts version", async () => {
    const client = makeMockClient();
    client.system.get.query.mockResolvedValue({ version: 5 });
    const api = createTRPCPersisterApi(client);

    const version = await api.system.getCurrentVersion(TEST_SYSTEM_ID);

    expect(version).toBe(5);
    expect(client.system.get.query).toHaveBeenCalledWith({ systemId: TEST_SYSTEM_ID });
  });

  it("update calls system.update with systemId, encryptedData, and version", async () => {
    const client = makeMockClient();
    client.system.update.mutate.mockResolvedValue({ id: "sys_1", version: 3 });
    const api = createTRPCPersisterApi(client);

    const result = await api.system.update(TEST_SYSTEM_ID, {
      encryptedData: "enc_data",
      version: 2,
    });

    expect(result).toEqual({ id: "sys_1", version: 3 });
    expect(client.system.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_data",
      version: 2,
    });
  });
});

// ── systemSettings ──────────────────────────────────────────────────

describe("systemSettings", () => {
  it("getCurrentVersion queries systemSettings.settings.get and extracts version", async () => {
    const client = makeMockClient();
    client.systemSettings.settings.get.query.mockResolvedValue({ version: 7 });
    const api = createTRPCPersisterApi(client);

    const version = await api.systemSettings.getCurrentVersion(TEST_SYSTEM_ID);

    expect(version).toBe(7);
    expect(client.systemSettings.settings.get.query).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });

  it("update calls systemSettings.settings.update", async () => {
    const client = makeMockClient();
    client.systemSettings.settings.update.mutate.mockResolvedValue({ id: "sset_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.systemSettings.update(TEST_SYSTEM_ID, {
      encryptedData: "enc_settings",
      version: 1,
    });

    expect(result).toEqual({ id: "sset_1", version: 2 });
    expect(client.systemSettings.settings.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_settings",
      version: 1,
    });
  });
});

// ── bucket ──────────────────────────────────────────────────────────

describe("bucket", () => {
  it("create calls bucket.create with systemId and encryptedData", async () => {
    const client = makeMockClient();
    client.bucket.create.mutate.mockResolvedValue({ id: "bkt_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.bucket.create(TEST_SYSTEM_ID, { encryptedData: "enc_bucket" });

    expect(result).toEqual({ id: "bkt_1", version: 1 });
    expect(client.bucket.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_bucket",
    });
  });

  it("update calls bucket.update with bucketId, encryptedData, and version", async () => {
    const client = makeMockClient();
    client.bucket.update.mutate.mockResolvedValue({ id: "bkt_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.bucket.update(TEST_SYSTEM_ID, "bkt_1", {
      encryptedData: "enc_bucket_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "bkt_1", version: 2 });
    expect(client.bucket.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      bucketId: "bkt_1",
      encryptedData: "enc_bucket_v2",
      version: 1,
    });
  });
});

// ── field ────────────────────────────────────────────────────────────

describe("field", () => {
  it("create calls field.definition.create with fieldType", async () => {
    const client = makeMockClient();
    client.field.definition.create.mutate.mockResolvedValue({ id: "fld_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.field.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_field",
      fieldType: "text",
      required: false,
      sortOrder: 0,
    });

    expect(result).toEqual({ id: "fld_1", version: 1 });
    expect(client.field.definition.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_field",
      fieldType: "text",
      required: false,
      sortOrder: 0,
    });
  });

  it("update calls field.definition.update with fieldDefinitionId", async () => {
    const client = makeMockClient();
    client.field.definition.update.mutate.mockResolvedValue({ id: "fld_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.field.update(TEST_SYSTEM_ID, "fld_1", {
      encryptedData: "enc_field_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "fld_1", version: 2 });
    expect(client.field.definition.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      fieldDefinitionId: "fld_1",
      encryptedData: "enc_field_v2",
      version: 1,
    });
  });

  it("setValue calls field.value.set with owner as member kind", async () => {
    const client = makeMockClient();
    client.field.value.set.mutate.mockResolvedValue({ id: "fv_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.field.setValue(TEST_SYSTEM_ID, {
      memberId: "mem_1",
      fieldDefinitionId: "fld_1",
      encryptedData: "enc_value",
    });

    expect(result).toEqual({ id: "fv_1", version: 1 });
    expect(client.field.value.set.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      fieldDefinitionId: "fld_1",
      owner: { kind: "member", id: "mem_1" },
      encryptedData: "enc_value",
    });
  });
});

// ── customFront ─────────────────────────────────────────────────────

describe("customFront", () => {
  it("create calls customFront.create", async () => {
    const client = makeMockClient();
    client.customFront.create.mutate.mockResolvedValue({ id: "cf_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.customFront.create(TEST_SYSTEM_ID, { encryptedData: "enc_cf" });

    expect(result).toEqual({ id: "cf_1", version: 1 });
    expect(client.customFront.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_cf",
    });
  });

  it("update calls customFront.update with customFrontId", async () => {
    const client = makeMockClient();
    client.customFront.update.mutate.mockResolvedValue({ id: "cf_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.customFront.update(TEST_SYSTEM_ID, "cf_1", {
      encryptedData: "enc_cf_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "cf_1", version: 2 });
    expect(client.customFront.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      customFrontId: "cf_1",
      encryptedData: "enc_cf_v2",
      version: 1,
    });
  });
});

// ── member ──────────────────────────────────────────────────────────

describe("member", () => {
  it("create calls member.create with encryptedData", async () => {
    const client = makeMockClient();
    client.member.create.mutate.mockResolvedValue({ id: "mem_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.member.create(TEST_SYSTEM_ID, { encryptedData: "enc_member" });

    expect(result).toEqual({ id: "mem_1", version: 1 });
    expect(client.member.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_member",
    });
  });

  it("update calls member.update with memberId", async () => {
    const client = makeMockClient();
    client.member.update.mutate.mockResolvedValue({ id: "mem_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.member.update(TEST_SYSTEM_ID, "mem_1", {
      encryptedData: "enc_member_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "mem_1", version: 2 });
    expect(client.member.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      memberId: "mem_1",
      encryptedData: "enc_member_v2",
      version: 1,
    });
  });
});

// ── friend ──────────────────────────────────────────────────────────

describe("friend", () => {
  it("recordExternalReference returns synthetic placeholder", async () => {
    const client = makeMockClient();
    const api = createTRPCPersisterApi(client);

    const result = await api.friend.recordExternalReference(
      TEST_SYSTEM_ID,
      "ext_user_abc",
      "accepted",
    );

    expect(result).toEqual({ placeholderId: "import_friend_ext_user_abc" });
  });

  it("recordExternalReference returns unique placeholders per externalUserId", async () => {
    const client = makeMockClient();
    const api = createTRPCPersisterApi(client);

    const a = await api.friend.recordExternalReference(TEST_SYSTEM_ID, "user_a", "pending");
    const b = await api.friend.recordExternalReference(TEST_SYSTEM_ID, "user_b", "accepted");

    expect(a.placeholderId).toBe("import_friend_user_a");
    expect(b.placeholderId).toBe("import_friend_user_b");
  });
});

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
