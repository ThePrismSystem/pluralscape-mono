/**
 * Import job REST endpoint coverage.
 *
 * Exercises the 6 new endpoints added for import-job management:
 *   POST   /v1/systems/:id/import-jobs
 *   GET    /v1/systems/:id/import-jobs
 *   GET    /v1/systems/:id/import-jobs/:jobId
 *   PATCH  /v1/systems/:id/import-jobs/:jobId
 *   (list with status filter)
 *
 * Tests use the real API server via Playwright request fixture.
 */
import { expect, test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";
import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_CREATED,
  HTTP_OK,
  parseJsonBody,
} from "../../fixtures/http.constants.js";

interface ImportJobResponse {
  id: string;
  systemId: string;
  status: string;
  source: string;
  progressPercent: number;
  completedAt: number | null;
}

interface ImportJobEnvelope {
  data: ImportJobResponse;
}

interface ImportJobListResponse {
  data: ImportJobResponse[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number | null;
}

const INITIAL_PROGRESS_PERCENT = 50;
const FINAL_PROGRESS_PERCENT = 100;

test.describe("Import job CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("full lifecycle: create, get, list, validating, importing, completed, terminal GET", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const importJobsUrl = `/v1/systems/${systemId}/import-jobs`;
    let importJobId = "";

    await test.step("POST creates pending job", async () => {
      const res = await request.post(importJobsUrl, {
        headers: authHeaders,
        data: {
          source: "simply-plural",
          selectedCategories: { member: true },
          avatarMode: "skip",
        },
      });
      expect(res.status()).toBe(HTTP_CREATED);
      const body = await parseJsonBody<ImportJobEnvelope>(res);
      expect(body.data.id).toMatch(/^ij_/);
      expect(body.data.status).toBe("pending");
      expect(body.data.progressPercent).toBe(0);
      expect(body.data.completedAt).toBeNull();
      importJobId = body.data.id;
    });

    await test.step("GET returns pending job", async () => {
      const res = await request.get(`${importJobsUrl}/${importJobId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<ImportJobEnvelope>(res);
      expect(body.data.id).toBe(importJobId);
      expect(body.data.status).toBe("pending");
    });

    await test.step("LIST includes new job", async () => {
      const res = await request.get(importJobsUrl, { headers: authHeaders });
      expect(res.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<ImportJobListResponse>(res);
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("hasMore");
      expect(body.data.some((j) => j.id === importJobId)).toBe(true);
    });

    await test.step("PATCH advances to validating", async () => {
      const res = await request.patch(`${importJobsUrl}/${importJobId}`, {
        headers: authHeaders,
        data: { status: "validating" },
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<ImportJobEnvelope>(res);
      expect(body.data.status).toBe("validating");
    });

    await test.step("PATCH advances to importing with progress", async () => {
      const res = await request.patch(`${importJobsUrl}/${importJobId}`, {
        headers: authHeaders,
        data: { status: "importing", progressPercent: INITIAL_PROGRESS_PERCENT },
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<ImportJobEnvelope>(res);
      expect(body.data.status).toBe("importing");
      expect(body.data.progressPercent).toBe(INITIAL_PROGRESS_PERCENT);
    });

    await test.step("PATCH completes the job", async () => {
      const res = await request.patch(`${importJobsUrl}/${importJobId}`, {
        headers: authHeaders,
        data: { status: "completed", progressPercent: FINAL_PROGRESS_PERCENT },
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<ImportJobEnvelope>(res);
      expect(body.data.status).toBe("completed");
      expect(body.data.progressPercent).toBe(FINAL_PROGRESS_PERCENT);
      expect(body.data.completedAt).not.toBeNull();
    });

    await test.step("GET confirms terminal state persisted", async () => {
      const res = await request.get(`${importJobsUrl}/${importJobId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<ImportJobEnvelope>(res);
      expect(body.data.status).toBe("completed");
      expect(body.data.progressPercent).toBe(FINAL_PROGRESS_PERCENT);
      expect(body.data.completedAt).not.toBeNull();
    });
  });

  test("illegal transition from terminal state returns 409 INVALID_STATE", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const importJobsUrl = `/v1/systems/${systemId}/import-jobs`;

    // Create and drive to completed
    const createRes = await request.post(importJobsUrl, {
      headers: authHeaders,
      data: { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "skip" },
    });
    const { data: job } = await parseJsonBody<ImportJobEnvelope>(createRes);

    await request.patch(`${importJobsUrl}/${job.id}`, {
      headers: authHeaders,
      data: { status: "validating" },
    });
    await request.patch(`${importJobsUrl}/${job.id}`, {
      headers: authHeaders,
      data: { status: "importing" },
    });
    await request.patch(`${importJobsUrl}/${job.id}`, {
      headers: authHeaders,
      data: { status: "completed" },
    });

    // Attempt illegal completed → pending transition
    const res = await request.patch(`${importJobsUrl}/${job.id}`, {
      headers: authHeaders,
      data: { status: "pending" },
    });
    expect(res.status()).toBe(HTTP_CONFLICT);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_STATE");
  });

  test("POST with empty selectedCategories returns 400 VALIDATION_ERROR", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const importJobsUrl = `/v1/systems/${systemId}/import-jobs`;

    const res = await request.post(importJobsUrl, {
      headers: authHeaders,
      data: {
        source: "simply-plural",
        selectedCategories: {},
        avatarMode: "skip",
      },
    });
    expect(res.status()).toBe(HTTP_BAD_REQUEST);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("LIST with status filter returns only matching jobs", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const importJobsUrl = `/v1/systems/${systemId}/import-jobs`;

    // Create a pending job
    const createRes = await request.post(importJobsUrl, {
      headers: authHeaders,
      data: { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "skip" },
    });
    const { data: job } = await parseJsonBody<ImportJobEnvelope>(createRes);

    // Advance it to validating
    await request.patch(`${importJobsUrl}/${job.id}`, {
      headers: authHeaders,
      data: { status: "validating" },
    });

    // Filter by validating — must include our job
    const validatingRes = await request.get(`${importJobsUrl}?status=validating`, {
      headers: authHeaders,
    });
    expect(validatingRes.status()).toBe(HTTP_OK);
    const validatingBody = await parseJsonBody<ImportJobListResponse>(validatingRes);
    expect(validatingBody.data.some((j) => j.id === job.id)).toBe(true);
    for (const j of validatingBody.data) {
      expect(j.status).toBe("validating");
    }

    // Filter by pending — must NOT include our job
    const pendingRes = await request.get(`${importJobsUrl}?status=pending`, {
      headers: authHeaders,
    });
    expect(pendingRes.status()).toBe(HTTP_OK);
    const pendingBody = await parseJsonBody<ImportJobListResponse>(pendingRes);
    expect(pendingBody.data.every((j) => j.id !== job.id)).toBe(true);
  });
});
