/**
 * Full import-job lifecycle via REST.
 *
 * Exercises the endpoints that the mobile import runner drives during a real
 * Simply Plural import: create (pending) → validating → importing with
 * progress → completed. Also verifies the terminal state is persisted and
 * readable by the caller.
 */
import { expect, test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";
import { HTTP_CREATED, HTTP_OK, parseJsonBody } from "../../fixtures/http.constants.js";

const INITIAL_PROGRESS_PERCENT = 50;
const INITIAL_CHUNKS_COMPLETED = 5;
const FINAL_PROGRESS_PERCENT = 100;

interface ImportJobEnvelope {
  data: {
    id: string;
    status: string;
    progressPercent: number;
    chunksCompleted: number;
  };
}

test.describe("Import job lifecycle", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("create, advance through statuses, and complete", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const importJobsUrl = `/v1/systems/${systemId}/import-jobs`;
    let importJobId = "";

    await test.step("create pending job", async () => {
      const createRes = await request.post(importJobsUrl, {
        headers: authHeaders,
        data: {
          source: "simply-plural",
          selectedCategories: {},
          avatarMode: "skip",
        },
      });
      expect(createRes.status()).toBe(HTTP_CREATED);
      const body = await parseJsonBody<ImportJobEnvelope>(createRes);
      expect(body.data.id).toMatch(/^ij_/);
      expect(body.data.status).toBe("pending");
      expect(body.data.progressPercent).toBe(0);
      importJobId = body.data.id;
    });

    await test.step("get returns pending", async () => {
      const getRes = await request.get(`${importJobsUrl}/${importJobId}`, {
        headers: authHeaders,
      });
      expect(getRes.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<ImportJobEnvelope>(getRes);
      expect(body.data.status).toBe("pending");
    });

    await test.step("advance to validating", async () => {
      const patchRes = await request.patch(`${importJobsUrl}/${importJobId}`, {
        headers: authHeaders,
        data: { status: "validating" },
      });
      expect(patchRes.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<ImportJobEnvelope>(patchRes);
      expect(body.data.status).toBe("validating");
    });

    await test.step("advance to importing with progress", async () => {
      const patchRes = await request.patch(`${importJobsUrl}/${importJobId}`, {
        headers: authHeaders,
        data: {
          status: "importing",
          progressPercent: INITIAL_PROGRESS_PERCENT,
          chunksCompleted: INITIAL_CHUNKS_COMPLETED,
        },
      });
      expect(patchRes.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<ImportJobEnvelope>(patchRes);
      expect(body.data.status).toBe("importing");
      expect(body.data.progressPercent).toBe(INITIAL_PROGRESS_PERCENT);
      expect(body.data.chunksCompleted).toBe(INITIAL_CHUNKS_COMPLETED);
    });

    await test.step("complete", async () => {
      const patchRes = await request.patch(`${importJobsUrl}/${importJobId}`, {
        headers: authHeaders,
        data: {
          status: "completed",
          progressPercent: FINAL_PROGRESS_PERCENT,
        },
      });
      expect(patchRes.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<ImportJobEnvelope>(patchRes);
      expect(body.data.status).toBe("completed");
      expect(body.data.progressPercent).toBe(FINAL_PROGRESS_PERCENT);
    });

    await test.step("get returns terminal state", async () => {
      const getRes = await request.get(`${importJobsUrl}/${importJobId}`, {
        headers: authHeaders,
      });
      expect(getRes.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<ImportJobEnvelope>(getRes);
      expect(body.data.status).toBe("completed");
      expect(body.data.progressPercent).toBe(FINAL_PROGRESS_PERCENT);
      expect(body.data.chunksCompleted).toBe(INITIAL_CHUNKS_COMPLETED);
    });
  });
});
