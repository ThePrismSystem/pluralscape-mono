import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createMember, getSystemId } from "../../fixtures/entity-helpers.js";
import { parseJsonBody } from "../../fixtures/http.constants.js";

test.describe("Fronting Analytics", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("fronting analytics returns breakdown for members with sessions", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    let memberAId: string;
    let memberBId: string;

    await test.step("create two members", async () => {
      const memberA = await createMember(request, authHeaders, systemId, "Analytics Member A");
      const memberB = await createMember(request, authHeaders, systemId, "Analytics Member B");
      memberAId = memberA.id;
      memberBId = memberB.id;
    });

    await test.step("create and end fronting sessions", async () => {
      const now = Date.now();
      const oneHourAgo = now - 3_600_000;

      // Member A: session from 1h ago to now
      const resA = await request.post(`/v1/systems/${systemId}/fronting-sessions`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ note: "Analytics A" }),
          startTime: oneHourAgo,
          memberId: memberAId,
        },
      });
      expect(resA.status()).toBe(201);
      const sessionA = await parseJsonBody<{ data: { id: string } }>(resA);

      await request.post(`/v1/systems/${systemId}/fronting-sessions/${sessionA.data.id}/end`, {
        headers: authHeaders,
        data: { endTime: now, version: 1 },
      });

      // Member B: session from 30min ago to now
      const thirtyMinAgo = now - 1_800_000;
      const resB = await request.post(`/v1/systems/${systemId}/fronting-sessions`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ note: "Analytics B" }),
          startTime: thirtyMinAgo,
          memberId: memberBId,
        },
      });
      expect(resB.status()).toBe(201);
      const sessionB = await parseJsonBody<{ data: { id: string } }>(resB);

      await request.post(`/v1/systems/${systemId}/fronting-sessions/${sessionB.data.id}/end`, {
        headers: authHeaders,
        data: { endTime: now, version: 1 },
      });
    });

    await test.step("GET fronting analytics with last-7-days preset", async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/analytics/fronting?preset=last-7-days`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);

      const body = await parseJsonBody<{
        data: {
          systemId: string;
          dateRange: { preset: string; start: number; end: number };
          subjectBreakdowns: Array<{
            subjectType: string;
            subjectId: string;
            totalDuration: number;
            sessionCount: number;
            averageSessionLength: number;
            percentageOfTotal: number;
          }>;
          truncated: boolean;
        };
      }>(res);

      expect(body.data.systemId).toBe(systemId);
      expect(body.data.dateRange.preset).toBe("last-7-days");
      expect(body.data.subjectBreakdowns.length).toBeGreaterThanOrEqual(2);
      expect(body.data.truncated).toBe(false);

      // Verify both members appear in breakdowns
      const subjectIds = body.data.subjectBreakdowns.map((b) => b.subjectId);
      expect(subjectIds).toContain(memberAId);
      expect(subjectIds).toContain(memberBId);

      // Verify each breakdown has expected structure
      for (const breakdown of body.data.subjectBreakdowns) {
        expect(breakdown.subjectType).toBeTruthy();
        expect(breakdown.totalDuration).toBeGreaterThanOrEqual(0);
        expect(breakdown.sessionCount).toBeGreaterThanOrEqual(1);
        expect(breakdown.averageSessionLength).toBeGreaterThanOrEqual(0);
        expect(breakdown.percentageOfTotal).toBeGreaterThanOrEqual(0);
        expect(breakdown.percentageOfTotal).toBeLessThanOrEqual(100);
      }
    });

    await test.step("GET fronting analytics defaults to last-30-days", async () => {
      const res = await request.get(`/v1/systems/${systemId}/analytics/fronting`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);

      const body = await parseJsonBody<{
        data: { dateRange: { preset: string } };
      }>(res);
      expect(body.data.dateRange.preset).toBe("last-30-days");
    });

    await test.step("GET fronting analytics with custom date range", async () => {
      const now = Date.now();
      const oneDayAgo = now - 86_400_000;

      const res = await request.get(
        `/v1/systems/${systemId}/analytics/fronting?preset=custom&startDate=${String(oneDayAgo)}&endDate=${String(now)}`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);

      const body = await parseJsonBody<{
        data: { dateRange: { preset: string; start: number; end: number } };
      }>(res);
      expect(body.data.dateRange.preset).toBe("custom");
      expect(body.data.dateRange.start).toBe(oneDayAgo);
      expect(body.data.dateRange.end).toBe(now);
    });
  });

  test("co-fronting analytics detects overlapping sessions", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    let memberAId: string;
    let memberBId: string;

    await test.step("create two members", async () => {
      const memberA = await createMember(request, authHeaders, systemId, "CoFront Member A");
      const memberB = await createMember(request, authHeaders, systemId, "CoFront Member B");
      memberAId = memberA.id;
      memberBId = memberB.id;
    });

    await test.step("create overlapping fronting sessions", async () => {
      const now = Date.now();
      const twoHoursAgo = now - 7_200_000;
      const oneHourAgo = now - 3_600_000;

      // Member A: session from 2h ago to now
      const resA = await request.post(`/v1/systems/${systemId}/fronting-sessions`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ note: "CoFront A" }),
          startTime: twoHoursAgo,
          memberId: memberAId,
        },
      });
      expect(resA.status()).toBe(201);
      const sessionA = await parseJsonBody<{ data: { id: string } }>(resA);

      await request.post(`/v1/systems/${systemId}/fronting-sessions/${sessionA.data.id}/end`, {
        headers: authHeaders,
        data: { endTime: now, version: 1 },
      });

      // Member B: session from 1h ago to now (overlaps with A for 1h)
      const resB = await request.post(`/v1/systems/${systemId}/fronting-sessions`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ note: "CoFront B" }),
          startTime: oneHourAgo,
          memberId: memberBId,
        },
      });
      expect(resB.status()).toBe(201);
      const sessionB = await parseJsonBody<{ data: { id: string } }>(resB);

      await request.post(`/v1/systems/${systemId}/fronting-sessions/${sessionB.data.id}/end`, {
        headers: authHeaders,
        data: { endTime: now, version: 1 },
      });
    });

    await test.step("GET co-fronting analytics", async () => {
      const res = await request.get(
        `/v1/systems/${systemId}/analytics/co-fronting?preset=last-7-days`,
        { headers: authHeaders },
      );
      expect(res.status()).toBe(200);

      const body = await parseJsonBody<{
        data: {
          systemId: string;
          dateRange: { preset: string };
          coFrontingPercentage: number;
          pairs: Array<{
            memberA: string;
            memberB: string;
            totalDuration: number;
            sessionCount: number;
            percentageOfTotal: number;
          }>;
          truncated: boolean;
        };
      }>(res);

      expect(body.data.systemId).toBe(systemId);
      expect(body.data.dateRange.preset).toBe("last-7-days");
      expect(body.data.coFrontingPercentage).toBeGreaterThan(0);
      expect(body.data.pairs.length).toBeGreaterThanOrEqual(1);
      expect(body.data.truncated).toBe(false);

      // Find the pair containing our two members
      const pair = body.data.pairs.find(
        (p) =>
          (p.memberA === memberAId && p.memberB === memberBId) ||
          (p.memberA === memberBId && p.memberB === memberAId),
      );
      expect(pair).toBeDefined();

      // Safe to access after toBeDefined assertion — structure validated above
      const matchedPair = pair as NonNullable<typeof pair>;
      expect(matchedPair.totalDuration).toBeGreaterThan(0);
      expect(matchedPair.sessionCount).toBeGreaterThanOrEqual(1);
    });

    await test.step("co-fronting analytics defaults to last-30-days", async () => {
      const res = await request.get(`/v1/systems/${systemId}/analytics/co-fronting`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);

      const body = await parseJsonBody<{
        data: { dateRange: { preset: string } };
      }>(res);
      expect(body.data.dateRange.preset).toBe("last-30-days");
    });
  });
});
