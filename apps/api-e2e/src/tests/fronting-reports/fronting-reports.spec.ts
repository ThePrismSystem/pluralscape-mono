import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";
import { parseJsonBody } from "../../fixtures/http.constants.js";

test.describe("Fronting Reports", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("fronting report lifecycle: create, list, get, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    let reportId: string;

    await test.step("create a fronting report", async () => {
      const res = await request.post(`/v1/systems/${systemId}/fronting-reports`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ title: "E2E Test Report" }),
          format: "html",
          generatedAt: Date.now(),
        },
      });
      expect(res.status()).toBe(201);

      const body = await parseJsonBody<{
        data: {
          id: string;
          systemId: string;
          format: string;
          generatedAt: number;
          version: number;
          archivedAt: null;
        };
      }>(res);
      expect(body.data).toHaveProperty("id");
      expect(body.data.systemId).toBe(systemId);
      expect(body.data.format).toBe("html");
      expect(body.data.generatedAt).toBeTruthy();
      expect(body.data.version).toBe(1);
      expect(body.data.archivedAt).toBeNull();
      reportId = body.data.id;
    });

    await test.step("list reports includes the new report", async () => {
      const res = await request.get(`/v1/systems/${systemId}/fronting-reports`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);

      const body = await parseJsonBody<{ data: Array<{ id: string }> }>(res);
      const ids = body.data.map((r) => r.id);
      expect(ids).toContain(reportId);
    });

    await test.step("get report by ID", async () => {
      const res = await request.get(`/v1/systems/${systemId}/fronting-reports/${reportId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);

      const body = await parseJsonBody<{
        data: { id: string; systemId: string; encryptedData: string };
      }>(res);
      expect(body.data.id).toBe(reportId);
      expect(body.data.systemId).toBe(systemId);
      expect(body.data.encryptedData).toBeTruthy();
    });

    await test.step("update report", async () => {
      const res = await request.put(`/v1/systems/${systemId}/fronting-reports/${reportId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ title: "Updated E2E Report" }),
          version: 1,
        },
      });
      expect(res.status()).toBe(200);

      const body = await parseJsonBody<{
        data: { id: string; version: number };
      }>(res);
      expect(body.data.id).toBe(reportId);
      expect(body.data.version).toBe(2);
    });

    await test.step("archive report", async () => {
      const res = await request.post(
        `/v1/systems/${systemId}/fronting-reports/${reportId}/archive`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(204);
    });

    await test.step("restore report", async () => {
      const res = await request.post(
        `/v1/systems/${systemId}/fronting-reports/${reportId}/restore`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);

      const body = await parseJsonBody<{
        data: { id: string; archivedAt: null };
      }>(res);
      expect(body.data.id).toBe(reportId);
      expect(body.data.archivedAt).toBeNull();
    });

    await test.step("delete report", async () => {
      const res = await request.delete(`/v1/systems/${systemId}/fronting-reports/${reportId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(204);
    });

    await test.step("verify deleted — 404", async () => {
      const res = await request.get(`/v1/systems/${systemId}/fronting-reports/${reportId}`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(404);
    });
  });

  test("create fronting report with pdf format", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    const res = await request.post(`/v1/systems/${systemId}/fronting-reports`, {
      headers: authHeaders,
      data: {
        encryptedData: encryptForApi({ title: "PDF Report" }),
        format: "pdf",
        generatedAt: Date.now(),
      },
    });
    expect(res.status()).toBe(201);

    const body = await parseJsonBody<{ data: { format: string } }>(res);
    expect(body.data.format).toBe("pdf");
  });

  test("create fronting report rejects invalid format", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    const res = await request.post(`/v1/systems/${systemId}/fronting-reports`, {
      headers: authHeaders,
      data: {
        encryptedData: encryptForApi({ title: "Bad Format" }),
        format: "csv",
        generatedAt: Date.now(),
      },
    });
    expect(res.status()).toBe(400);
  });
});
