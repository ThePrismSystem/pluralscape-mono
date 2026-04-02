import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { expect, test } from "../../fixtures/trpc.fixture.js";

const MEMBER_PROFILE = {
  name: "tRPC E2E Member",
  pronouns: "they/them",
  description: "Created by tRPC E2E test",
  color: "#FF6B9D",
};

const UPDATED_PROFILE = {
  name: "tRPC E2E Member (Updated)",
  pronouns: "she/her",
  description: "Updated by tRPC E2E test",
  color: "#4ECDC4",
};

test.describe("tRPC member router", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("member lifecycle: create, get, update, list, archive, restore, delete", async ({
    trpc,
  }) => {
    const systemsResult = await trpc.system.list.query({});
    const systemId = systemsResult.data[0]?.id;
    expect(systemId).toBeTruthy();

    let memberId: string;
    let memberVersion: number;

    await test.step("create with encrypted data", async () => {
      const result = await trpc.member.create.mutate({
        systemId,
        encryptedData: encryptForApi(MEMBER_PROFILE),
      });
      expect(result).toHaveProperty("id");
      memberId = result.id;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const result = await trpc.member.get.query({ systemId, memberId });
      expect(result.id).toBe(memberId);
      expect(result).toHaveProperty("encryptedData");

      const decrypted = decryptFromApi(result.encryptedData);
      expect(decrypted).toEqual(MEMBER_PROFILE);
      memberVersion = result.version;
    });

    await test.step("list includes created member", async () => {
      const result = await trpc.member.list.query({ systemId });
      expect(Array.isArray(result.data)).toBe(true);
      const ids = result.data.map((m: { id: string }) => m.id);
      expect(ids).toContain(memberId);
    });

    await test.step("update with new encrypted data", async () => {
      const updateResult = await trpc.member.update.mutate({
        systemId,
        memberId,
        encryptedData: encryptForApi(UPDATED_PROFILE),
        version: memberVersion,
      });
      expect(updateResult).toHaveProperty("id", memberId);

      const getResult = await trpc.member.get.query({ systemId, memberId });
      const decrypted = decryptFromApi(getResult.encryptedData);
      expect(decrypted).toEqual(UPDATED_PROFILE);
    });

    await test.step("archive member", async () => {
      const result = await trpc.member.archive.mutate({ systemId, memberId });
      expect(result.success).toBe(true);
    });

    await test.step("restore member", async () => {
      const result = await trpc.member.restore.mutate({ systemId, memberId });
      expect(result).toHaveProperty("id", memberId);
    });

    await test.step("delete member", async () => {
      const result = await trpc.member.delete.mutate({ systemId, memberId });
      expect(result.success).toBe(true);
    });
  });
});
