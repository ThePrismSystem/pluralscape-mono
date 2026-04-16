import { describe, expect, it, vi } from "vitest";

import { QuotaExceededError } from "../errors.js";
import { BlobQuotaService, createQuotaService } from "../quota/quota-service.js";

import type { BlobUsageQuery } from "../quota/quota-service.js";
import type { SystemId } from "@pluralscape/types";

function mockUsageQuery(usedBytes: number): BlobUsageQuery {
  return { getUsedBytes: vi.fn().mockResolvedValue(usedBytes) };
}

describe("BlobQuotaService", () => {
  describe("getUsage", () => {
    it("returns used bytes and quota for a system", async () => {
      const query = mockUsageQuery(500);
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, query);

      const usage = await service.getUsage("sys_abc" as SystemId);
      expect(usage).toEqual({ usedBytes: 500, quotaBytes: 1000 });
    });

    it("uses per-system override when available", async () => {
      const query = mockUsageQuery(200);
      const service = new BlobQuotaService(
        {
          defaultQuotaBytes: 1000,
          perSystemOverrides: { ["sys_vip" as SystemId]: 5000 },
        },
        query,
      );

      const usage = await service.getUsage("sys_vip" as SystemId);
      expect(usage).toEqual({ usedBytes: 200, quotaBytes: 5000 });
    });

    it("falls back to default when no override exists", async () => {
      const query = mockUsageQuery(100);
      const service = new BlobQuotaService(
        {
          defaultQuotaBytes: 1000,
          perSystemOverrides: { ["sys_other" as SystemId]: 5000 },
        },
        query,
      );

      const usage = await service.getUsage("sys_nomatch" as SystemId);
      expect(usage).toEqual({ usedBytes: 100, quotaBytes: 1000 });
    });
  });

  describe("checkQuota", () => {
    it("allows upload within quota", async () => {
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, mockUsageQuery(400));

      const result = await service.checkQuota("sys_abc" as SystemId, 500);
      expect(result).toEqual({ allowed: true, usedBytes: 400, quotaBytes: 1000 });
    });

    it("allows upload at exact quota boundary", async () => {
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, mockUsageQuery(500));

      const result = await service.checkQuota("sys_abc" as SystemId, 500);
      expect(result).toEqual({ allowed: true, usedBytes: 500, quotaBytes: 1000 });
    });

    it("rejects upload exceeding quota", async () => {
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, mockUsageQuery(800));

      const result = await service.checkQuota("sys_abc" as SystemId, 300);
      expect(result).toEqual({ allowed: false, usedBytes: 800, quotaBytes: 1000 });
    });

    it("rejects when already at quota", async () => {
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, mockUsageQuery(1000));

      const result = await service.checkQuota("sys_abc" as SystemId, 1);
      expect(result).toEqual({ allowed: false, usedBytes: 1000, quotaBytes: 1000 });
    });
  });

  describe("assertQuota", () => {
    it("does not throw when within quota", async () => {
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, mockUsageQuery(100));
      await expect(service.assertQuota("sys_abc" as SystemId, 500)).resolves.toBeUndefined();
    });

    it("throws QuotaExceededError when over quota", async () => {
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, mockUsageQuery(900));
      await expect(service.assertQuota("sys_abc" as SystemId, 200)).rejects.toThrow(
        QuotaExceededError,
      );
    });

    it("includes all relevant info in the error", async () => {
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, mockUsageQuery(800));
      try {
        await service.assertQuota("sys_abc" as SystemId, 300);
        expect.fail("Should have thrown");
      } catch (err) {
        if (!(err instanceof QuotaExceededError)) throw err;
        expect(err.systemId).toBe("sys_abc");
        expect(err.usedBytes).toBe(800);
        expect(err.quotaBytes).toBe(1000);
        expect(err.requestedBytes).toBe(300);
      }
    });
  });

  describe("createQuotaService", () => {
    it("creates service with default quota", async () => {
      const query = mockUsageQuery(0);
      const service = createQuotaService(query);
      const usage = await service.getUsage("sys_abc" as SystemId);
      // DEFAULT_QUOTA_BYTES = 1 GiB
      expect(usage.quotaBytes).toBe(1_073_741_824);
    });

    it("accepts partial config overrides", async () => {
      const query = mockUsageQuery(0);
      const service = createQuotaService(query, { defaultQuotaBytes: 500 });
      const usage = await service.getUsage("sys_abc" as SystemId);
      expect(usage.quotaBytes).toBe(500);
    });
  });

  describe("reserveQuota (advisory)", () => {
    it("resolves when upload is within quota", async () => {
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, mockUsageQuery(100));
      await expect(service.reserveQuota("sys_abc" as SystemId, 500)).resolves.toBeUndefined();
    });

    it("resolves at exact quota boundary", async () => {
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, mockUsageQuery(500));
      await expect(service.reserveQuota("sys_abc" as SystemId, 500)).resolves.toBeUndefined();
    });

    it("throws QuotaExceededError when over quota", async () => {
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, mockUsageQuery(900));
      await expect(service.reserveQuota("sys_abc" as SystemId, 200)).rejects.toThrow(
        QuotaExceededError,
      );
    });
  });

  describe("error propagation", () => {
    it("propagates usage query errors through getUsage", async () => {
      const failingQuery: BlobUsageQuery = {
        getUsedBytes: vi.fn().mockRejectedValue(new Error("DB connection lost")),
      };
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, failingQuery);

      await expect(service.getUsage("sys_abc" as SystemId)).rejects.toThrow("DB connection lost");
    });

    it("propagates usage query errors through checkQuota", async () => {
      const failingQuery: BlobUsageQuery = {
        getUsedBytes: vi.fn().mockRejectedValue(new Error("DB connection lost")),
      };
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, failingQuery);

      await expect(service.checkQuota("sys_abc" as SystemId, 100)).rejects.toThrow(
        "DB connection lost",
      );
    });

    it("propagates usage query errors through assertQuota", async () => {
      const failingQuery: BlobUsageQuery = {
        getUsedBytes: vi.fn().mockRejectedValue(new Error("DB connection lost")),
      };
      const service = new BlobQuotaService({ defaultQuotaBytes: 1000 }, failingQuery);

      await expect(service.assertQuota("sys_abc" as SystemId, 100)).rejects.toThrow(
        "DB connection lost",
      );
    });
  });
});
