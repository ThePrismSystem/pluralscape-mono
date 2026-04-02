import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { expect, test } from "../../fixtures/trpc.fixture.js";

test.describe("tRPC frontingSession router", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("fronting lifecycle: create member, start session, list active, end, delete", async ({
    trpc,
  }) => {
    const systemsResult = await trpc.system.list.query({});
    const systemId = systemsResult.data[0]?.id;
    expect(systemId).toBeTruthy();

    let memberId: string;
    let sessionId: string;
    let sessionVersion: number;

    await test.step("create member to front", async () => {
      const result = await trpc.member.create.mutate({
        systemId,
        encryptedData: encryptForApi({ name: "tRPC Fronting Member" }),
      });
      expect(result).toHaveProperty("id");
      memberId = result.id;
    });

    await test.step("start fronting session", async () => {
      const result = await trpc.frontingSession.create.mutate({
        systemId,
        memberId,
        customFrontId: null,
        structureEntityId: null,
        startTime: Date.now(),
        encryptedData: encryptForApi({ note: "tRPC E2E fronting session" }),
      });
      expect(result).toHaveProperty("id");
      expect(result.memberId).toBe(memberId);
      expect(result.endTime).toBeNull();
      sessionId = result.id;
      sessionVersion = result.version;
    });

    await test.step("list active sessions includes the new session", async () => {
      const result = await trpc.frontingSession.list.query({
        systemId,
        activeOnly: true,
      });
      expect(Array.isArray(result.data)).toBe(true);
      const ids = result.data.map((s: { id: string }) => s.id);
      expect(ids).toContain(sessionId);
    });

    await test.step("get active fronting returns the session", async () => {
      const result = await trpc.frontingSession.getActive.query({ systemId });
      expect(Array.isArray(result.sessions)).toBe(true);
      const ids = result.sessions.map((s: { id: string }) => s.id);
      expect(ids).toContain(sessionId);
    });

    await test.step("end fronting session", async () => {
      const result = await trpc.frontingSession.end.mutate({
        systemId,
        sessionId,
        endTime: Date.now(),
        version: sessionVersion,
      });
      expect(result.endTime).not.toBeNull();
    });

    await test.step("clean up: delete member (cascades session)", async () => {
      await trpc.frontingSession.delete.mutate({ systemId, sessionId });
      await trpc.member.delete.mutate({ systemId, memberId });
    });
  });
});
