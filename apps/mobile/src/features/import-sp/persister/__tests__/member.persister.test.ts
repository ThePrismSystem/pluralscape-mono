import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestIdTranslation,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { memberPersister } from "../member.persister.js";

import type { AvatarFetcher } from "@pluralscape/import-sp/avatar-fetcher-types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const AVATAR_BYTES = new Uint8Array([1, 2, 3, 4]);

const MEMBER_NO_AVATAR = {
  member: {
    name: "Aurora",
    description: null,
    pronouns: "they/them",
    colors: ["#aabbcc"],
    avatarUrl: null,
    archived: false,
  },
  fieldValues: [],
  bucketSourceIds: [],
};

const MEMBER_WITH_AVATAR = {
  member: {
    name: "Bellamy",
    description: "the dreamer",
    pronouns: null,
    colors: [],
    avatarUrl: "https://example.com/avatar.png",
    archived: false,
  },
  fieldValues: [],
  bucketSourceIds: [],
};

function makeAvatarFetcher(
  result:
    | { readonly status: "ok"; readonly bytes: Uint8Array; readonly contentType: string }
    | { readonly status: "not-found" }
    | { readonly status: "error"; readonly message: string },
): AvatarFetcher {
  return {
    fetchAvatar: vi.fn<AvatarFetcher["fetchAvatar"]>().mockResolvedValue(result),
  };
}

describe("memberPersister — no avatar path", () => {
  it("creates the member with just encryptedData (no avatarBlobId)", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.member.create);

    const result = await memberPersister.create(ctx, MEMBER_NO_AVATAR);

    expect(createFn).toHaveBeenCalledTimes(1);
    const call = createFn.mock.calls[0];
    expect(call?.[0]).toBe(TEST_SYSTEM_ID);
    expect(call?.[1]).toEqual({ encryptedData: expect.any(String) });
    expect(result.pluralscapeEntityId).toBe("mem_1");
  });
});

describe("memberPersister — avatar happy path", () => {
  it("fetches, uploads, and attaches the blob ID to the member create", async () => {
    const avatarFetcher = makeAvatarFetcher({
      status: "ok",
      bytes: AVATAR_BYTES,
      contentType: "image/png",
    });
    const ctx = makeTestPersisterContext({ avatarFetcher });
    const uploadAvatar = vi.mocked(ctx.api.blob.uploadAvatar);
    const createFn = vi.mocked(ctx.api.member.create);

    await memberPersister.create(ctx, MEMBER_WITH_AVATAR);

    expect(uploadAvatar).toHaveBeenCalledWith(TEST_SYSTEM_ID, {
      bytes: AVATAR_BYTES,
      contentType: "image/png",
    });
    const call = createFn.mock.calls[0];
    expect(call?.[1]).toEqual({
      encryptedData: expect.any(String),
      avatarBlobId: "blob_1",
    });
  });
});

describe("memberPersister — avatar not-found still creates", () => {
  it("creates the member without an avatar blob id and records no error", async () => {
    const avatarFetcher = makeAvatarFetcher({ status: "not-found" });
    const ctx = makeTestPersisterContext({ avatarFetcher });
    const createFn = vi.mocked(ctx.api.member.create);
    const uploadAvatar = vi.mocked(ctx.api.blob.uploadAvatar);
    const recordError = vi.mocked(ctx.recordError);

    const result = await memberPersister.create(ctx, MEMBER_WITH_AVATAR);

    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(recordError).not.toHaveBeenCalled();
    const call = createFn.mock.calls[0];
    expect(call?.[1]).toEqual({ encryptedData: expect.any(String) });
    expect(result.pluralscapeEntityId).toBe("mem_1");
  });
});

describe("memberPersister — avatar fetch error path", () => {
  it("records an error, still creates the member, and does not attach a blob id", async () => {
    const avatarFetcher = makeAvatarFetcher({
      status: "error",
      message: "network down",
    });
    const ctx = makeTestPersisterContext({ avatarFetcher });
    const createFn = vi.mocked(ctx.api.member.create);
    const uploadAvatar = vi.mocked(ctx.api.blob.uploadAvatar);
    const recordError = vi.mocked(ctx.recordError);

    await memberPersister.create(ctx, MEMBER_WITH_AVATAR);

    expect(recordError).toHaveBeenCalledTimes(1);
    const errorArg = recordError.mock.calls[0]?.[0];
    expect(errorArg?.entityType).toBe("member");
    expect(errorArg?.message).toMatch(/avatar fetch failed/);
    expect(uploadAvatar).not.toHaveBeenCalled();
    const call = createFn.mock.calls[0];
    expect(call?.[1]).toEqual({ encryptedData: expect.any(String) });
  });
});

describe("memberPersister — field-value fan-out", () => {
  it("resolves each field definition and calls field.setValue per field value", async () => {
    const idTable = makeTestIdTranslation();
    idTable.set("field-definition", "sp_field_a", "fld_a");
    idTable.set("field-definition", "sp_field_b", "fld_b");
    const ctx = makeTestPersisterContext({ idTranslation: idTable });
    const setValue = vi.mocked(ctx.api.field.setValue);

    await memberPersister.create(ctx, {
      ...MEMBER_NO_AVATAR,
      fieldValues: [
        { memberSourceId: "sp_mem_1", fieldSourceId: "sp_field_a", value: "hi" },
        { memberSourceId: "sp_mem_1", fieldSourceId: "sp_field_b", value: "there" },
      ],
    });

    expect(setValue).toHaveBeenCalledTimes(2);
    expect(setValue).toHaveBeenNthCalledWith(
      1,
      TEST_SYSTEM_ID,
      expect.objectContaining({ memberId: "mem_1", fieldDefinitionId: "fld_a" }),
    );
    expect(setValue).toHaveBeenNthCalledWith(
      2,
      TEST_SYSTEM_ID,
      expect.objectContaining({ memberId: "mem_1", fieldDefinitionId: "fld_b" }),
    );
  });

  it("records an error and skips the field value when the field definition is unresolved", async () => {
    const ctx = makeTestPersisterContext();
    const setValue = vi.mocked(ctx.api.field.setValue);
    const recordError = vi.mocked(ctx.recordError);

    await memberPersister.create(ctx, {
      ...MEMBER_NO_AVATAR,
      fieldValues: [{ memberSourceId: "sp_mem_1", fieldSourceId: "sp_field_missing", value: "x" }],
    });

    expect(setValue).not.toHaveBeenCalled();
    expect(recordError).toHaveBeenCalledTimes(1);
    const errorArg = recordError.mock.calls[0]?.[0];
    expect(errorArg?.entityType).toBe("field-value");
  });
});
