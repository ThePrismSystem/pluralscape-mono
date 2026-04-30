/**
 * tRPC-backed PersisterApi bridge tests — comms and bulk entity groups.
 *
 * Covers: poll, channel, message, boardMessage, group, blob, importEntityRef
 * Companion file: trpc-persister-api-core.test.ts
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

// ── poll ────────────────────────────────────────────────────────────

describe("poll", () => {
  it("create calls poll.create with poll config fields", async () => {
    const client = makeMockClient();
    client.poll.create.mutate.mockResolvedValue({ id: "poll_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.poll.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_poll",
      kind: "standard",
      allowMultipleVotes: false,
      maxVotesPerMember: 1,
      allowAbstain: true,
      allowVeto: false,
    });

    expect(result).toEqual({ id: "poll_1", version: 1 });
    expect(client.poll.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_poll",
      kind: "standard",
      createdByMemberId: undefined,
      allowMultipleVotes: false,
      maxVotesPerMember: 1,
      allowAbstain: true,
      allowVeto: false,
    });
  });

  it("update calls poll.update with pollId", async () => {
    const client = makeMockClient();
    client.poll.update.mutate.mockResolvedValue({ id: "poll_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.poll.update(TEST_SYSTEM_ID, "poll_1", {
      encryptedData: "enc_poll_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "poll_1", version: 2 });
    expect(client.poll.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll_1",
      encryptedData: "enc_poll_v2",
      version: 1,
    });
  });

  it("castVote calls poll.castVote with pollId and voter info", async () => {
    const client = makeMockClient();
    client.poll.castVote.mutate.mockResolvedValue({ id: "pv_1" });
    const api = createTRPCPersisterApi(client);

    const result = await api.poll.castVote(TEST_SYSTEM_ID, {
      pollId: "poll_1",
      memberId: "mem_1",
      encryptedData: "enc_vote",
    });

    expect(result).toEqual({ id: "pv_1" });
    expect(client.poll.castVote.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll_1",
      encryptedData: "enc_vote",
    });
  });

  it("castVote handles null memberId", async () => {
    const client = makeMockClient();
    client.poll.castVote.mutate.mockResolvedValue({ id: "pv_2" });
    const api = createTRPCPersisterApi(client);

    const result = await api.poll.castVote(TEST_SYSTEM_ID, {
      pollId: "poll_1",
      memberId: null,
      encryptedData: "enc_vote",
    });

    expect(result).toEqual({ id: "pv_2" });
  });
});

// ── channel ─────────────────────────────────────────────────────────

describe("channel", () => {
  it("create calls channel.create with type, parentId, and sortOrder", async () => {
    const client = makeMockClient();
    client.channel.create.mutate.mockResolvedValue({ id: "ch_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.channel.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_channel",
      type: "channel",
      parentId: null,
      sortOrder: 0,
    });

    expect(result).toEqual({ id: "ch_1", version: 1 });
    expect(client.channel.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_channel",
      type: "channel",
      parentId: null,
      sortOrder: 0,
    });
  });

  it("create passes non-null parentId through", async () => {
    const client = makeMockClient();
    client.channel.create.mutate.mockResolvedValue({ id: "ch_2", version: 1 });
    const api = createTRPCPersisterApi(client);

    await api.channel.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_channel",
      type: "category",
      parentId: "ch_parent",
      sortOrder: 3,
    });

    expect(client.channel.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_channel",
      type: "category",
      parentId: "ch_parent",
      sortOrder: 3,
    });
  });

  it("update calls channel.update with channelId", async () => {
    const client = makeMockClient();
    client.channel.update.mutate.mockResolvedValue({ id: "ch_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.channel.update(TEST_SYSTEM_ID, "ch_1", {
      encryptedData: "enc_channel_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "ch_1", version: 2 });
    expect(client.channel.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: "ch_1",
      encryptedData: "enc_channel_v2",
      version: 1,
    });
  });
});

// ── message ─────────────────────────────────────────────────────────

describe("message", () => {
  it("create calls message.create with channelId and timestamp", async () => {
    const client = makeMockClient();
    client.message.create.mutate.mockResolvedValue({ id: "msg_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.message.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_message",
      channelId: "ch_1",
      timestamp: 1_700_000_000,
      replyToId: null,
    });

    expect(result).toEqual({ id: "msg_1", version: 1 });
    expect(client.message.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: "ch_1",
      encryptedData: "enc_message",
      timestamp: 1_700_000_000,
      replyToId: null,
    });
  });

  it("update calls message.update with messageId and channelId", async () => {
    const client = makeMockClient();
    client.message.update.mutate.mockResolvedValue({ id: "msg_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.message.update(TEST_SYSTEM_ID, "msg_1", {
      encryptedData: "enc_message_v2",
      version: 1,
      channelId: "ch_real_channel",
    });

    expect(result).toEqual({ id: "msg_1", version: 2 });
    expect(client.message.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: "ch_real_channel",
      messageId: "msg_1",
      encryptedData: "enc_message_v2",
      version: 1,
    });
  });
});

// ── boardMessage ────────────────────────────────────────────────────

describe("boardMessage", () => {
  it("create calls boardMessage.create with sortOrder", async () => {
    const client = makeMockClient();
    client.boardMessage.create.mutate.mockResolvedValue({ id: "bm_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.boardMessage.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_bm",
      sortOrder: 0,
      pinned: false,
    });

    expect(result).toEqual({ id: "bm_1", version: 1 });
    expect(client.boardMessage.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_bm",
      sortOrder: 0,
      pinned: false,
    });
  });

  it("update calls boardMessage.update with boardMessageId", async () => {
    const client = makeMockClient();
    client.boardMessage.update.mutate.mockResolvedValue({ id: "bm_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.boardMessage.update(TEST_SYSTEM_ID, "bm_1", {
      encryptedData: "enc_bm_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "bm_1", version: 2 });
    expect(client.boardMessage.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      boardMessageId: "bm_1",
      encryptedData: "enc_bm_v2",
      version: 1,
    });
  });
});

// ── group ───────────────────────────────────────────────────────────

describe("group", () => {
  it("create calls group.create then addMember for each memberIds entry", async () => {
    const client = makeMockClient();
    client.group.create.mutate.mockResolvedValue({ id: "grp_1", version: 1 });
    client.group.addMember.mutate.mockResolvedValue({ success: true });
    const api = createTRPCPersisterApi(client);

    const result = await api.group.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_group",
      memberIds: ["mem_1", "mem_2"],
      parentGroupId: null,
      sortOrder: 0,
    });

    expect(result).toEqual({ id: "grp_1", version: 1 });
    expect(client.group.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_group",
      parentGroupId: null,
      sortOrder: 0,
    });
    expect(client.group.addMember.mutate).toHaveBeenCalledTimes(2);
    expect(client.group.addMember.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      groupId: "grp_1",
      memberId: "mem_1",
    });
    expect(client.group.addMember.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      groupId: "grp_1",
      memberId: "mem_2",
    });
  });

  it("create with empty memberIds does not call addMember", async () => {
    const client = makeMockClient();
    client.group.create.mutate.mockResolvedValue({ id: "grp_2", version: 1 });
    const api = createTRPCPersisterApi(client);

    await api.group.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_group",
      memberIds: [],
      parentGroupId: null,
      sortOrder: 0,
    });

    expect(client.group.addMember.mutate).not.toHaveBeenCalled();
  });

  it("update calls group.update with groupId", async () => {
    const client = makeMockClient();
    client.group.update.mutate.mockResolvedValue({ id: "grp_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.group.update(TEST_SYSTEM_ID, "grp_1", {
      encryptedData: "enc_group_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "grp_1", version: 2 });
    expect(client.group.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      groupId: "grp_1",
      encryptedData: "enc_group_v2",
      version: 1,
    });
  });
});

// ── blob ────────────────────────────────────────────────────────────

describe("blob", () => {
  it("uploadAvatar performs 3-step upload: createUploadUrl, PUT, confirmUpload", async () => {
    const client = makeMockClient();
    const mockUploadUrl = "https://s3.example.com/upload?sig=abc";
    client.blob.createUploadUrl.mutate.mockResolvedValue({
      blobId: "blob_1",
      uploadUrl: mockUploadUrl,
    });
    client.blob.confirmUpload.mutate.mockResolvedValue({ id: "blob_1", version: 1 });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const api = createTRPCPersisterApi(client, mockFetch);

    const bytes = new Uint8Array([1, 2, 3, 4]);
    const result = await api.blob.uploadAvatar(TEST_SYSTEM_ID, {
      bytes,
      contentType: "image/png",
    });

    expect(result).toEqual({ blobId: "blob_1" });

    expect(client.blob.createUploadUrl.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      purpose: "avatar",
      mimeType: "image/png",
      sizeBytes: 4,
      encryptionTier: 1,
    });

    expect(mockFetch).toHaveBeenCalledWith(mockUploadUrl, {
      method: "PUT",
      body: bytes,
      headers: { "Content-Type": "image/png" },
    });

    expect(client.blob.confirmUpload.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      blobId: "blob_1",
      checksum: "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
    });
  });

  it("uploadAvatar throws when S3 PUT fails", async () => {
    const client = makeMockClient();
    client.blob.createUploadUrl.mutate.mockResolvedValue({
      blobId: "blob_1",
      uploadUrl: "https://s3.example.com/upload",
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const api = createTRPCPersisterApi(client, mockFetch);

    await expect(
      api.blob.uploadAvatar(TEST_SYSTEM_ID, {
        bytes: new Uint8Array([1]),
        contentType: "image/png",
      }),
    ).rejects.toThrow("S3 upload failed");
  });
});

// ── importEntityRef ─────────────────────────────────────────────────

describe("importEntityRef", () => {
  describe("lookupBatch", () => {
    it("groups refs by sourceEntityType and makes separate tRPC calls", async () => {
      const client = makeMockClient();
      client.importEntityRef.lookupBatch.mutate
        .mockResolvedValueOnce({ src_member_1: "mem_1" })
        .mockResolvedValueOnce({ src_field_1: "fld_1" });

      const api = createTRPCPersisterApi(client);

      const result = await api.importEntityRef.lookupBatch(TEST_SYSTEM_ID, {
        source: "simply-plural",
        refs: [
          { sourceEntityType: "member", sourceEntityId: "src_member_1" },
          { sourceEntityType: "field-definition", sourceEntityId: "src_field_1" },
        ],
      });

      expect(client.importEntityRef.lookupBatch.mutate).toHaveBeenCalledTimes(2);
      expect(client.importEntityRef.lookupBatch.mutate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityIds: ["src_member_1"],
      });
      expect(client.importEntityRef.lookupBatch.mutate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        source: "simply-plural",
        sourceEntityType: "field-definition",
        sourceEntityIds: ["src_field_1"],
      });

      expect(result).toEqual({
        src_member_1: "mem_1",
        src_field_1: "fld_1",
      });
    });

    it("groups multiple refs of same type into one call", async () => {
      const client = makeMockClient();
      client.importEntityRef.lookupBatch.mutate.mockResolvedValueOnce({
        src_1: "mem_1",
        src_2: "mem_2",
      });

      const api = createTRPCPersisterApi(client);

      const result = await api.importEntityRef.lookupBatch(TEST_SYSTEM_ID, {
        source: "simply-plural",
        refs: [
          { sourceEntityType: "member", sourceEntityId: "src_1" },
          { sourceEntityType: "member", sourceEntityId: "src_2" },
        ],
      });

      expect(client.importEntityRef.lookupBatch.mutate).toHaveBeenCalledTimes(1);
      expect(client.importEntityRef.lookupBatch.mutate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityIds: ["src_1", "src_2"],
      });
      expect(result).toEqual({ src_1: "mem_1", src_2: "mem_2" });
    });

    it("returns empty record for empty refs array", async () => {
      const client = makeMockClient();
      const api = createTRPCPersisterApi(client);

      const result = await api.importEntityRef.lookupBatch(TEST_SYSTEM_ID, {
        source: "simply-plural",
        refs: [],
      });

      expect(result).toEqual({});
      expect(client.importEntityRef.lookupBatch.mutate).not.toHaveBeenCalled();
    });
  });

  describe("upsertBatch", () => {
    it("reshapes refs to entries for tRPC call", async () => {
      const client = makeMockClient();
      client.importEntityRef.upsertBatch.mutate.mockResolvedValue({ upserted: 2 });
      const api = createTRPCPersisterApi(client);

      const result = await api.importEntityRef.upsertBatch(TEST_SYSTEM_ID, {
        source: "simply-plural",
        refs: [
          {
            sourceEntityType: "member",
            sourceEntityId: "src_1",
            pluralscapeEntityId: "mem_1",
          },
          {
            sourceEntityType: "field-definition",
            sourceEntityId: "src_2",
            pluralscapeEntityId: "fld_1",
          },
        ],
      });

      expect(result).toEqual({ upserted: 2 });
      expect(client.importEntityRef.upsertBatch.mutate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        source: "simply-plural",
        entries: [
          {
            sourceEntityType: "member",
            sourceEntityId: "src_1",
            pluralscapeEntityId: "mem_1",
          },
          {
            sourceEntityType: "field-definition",
            sourceEntityId: "src_2",
            pluralscapeEntityId: "fld_1",
          },
        ],
      });
    });

    it("returns upserted: 0 for empty refs array", async () => {
      const client = makeMockClient();
      const api = createTRPCPersisterApi(client);

      const result = await api.importEntityRef.upsertBatch(TEST_SYSTEM_ID, {
        source: "simply-plural",
        refs: [],
      });

      expect(result).toEqual({ upserted: 0 });
      expect(client.importEntityRef.upsertBatch.mutate).not.toHaveBeenCalled();
    });
  });
});
