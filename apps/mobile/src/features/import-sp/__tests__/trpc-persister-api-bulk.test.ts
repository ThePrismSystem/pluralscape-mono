/**
 * tRPC PersisterApi bridge tests — group, blob, importEntityRef.
 *
 * Companion files: trpc-persister-api-core.test.ts,
 *                  trpc-persister-api-fronting.test.ts,
 *                  trpc-persister-api-comms.test.ts
 */

import { brandId } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { createTRPCPersisterApi } from "../trpc-persister-api.js";

import { makeMockClient } from "./helpers/trpc-mock-client.js";

import type { SystemId } from "@pluralscape/types";

const TEST_SYSTEM_ID = brandId<SystemId>("sys_bridge_test");

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
