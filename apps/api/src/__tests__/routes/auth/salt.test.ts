import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockDbFactory, mockRateLimitFactory } from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../lib/anti-enum-timing.js", () => ({
  equalizeAntiEnumTiming: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/email-hash.js", () => ({
  hashEmail: vi.fn().mockReturnValue("fakehash"),
}));

// Mock crypto to avoid native binary dependency in unit tests
vi.mock("@pluralscape/crypto", () => ({
  PWHASH_SALT_BYTES: 16,
  getSodium: vi.fn().mockReturnValue({
    genericHash: vi.fn().mockImplementation((_len: number, input: Uint8Array) => {
      // Return a deterministic 16-byte output based on input
      const out = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        out[i] = input[i % input.length] ?? 0;
      }
      return out;
    }),
  }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { getDb } = await import("../../../lib/db.js");
const { equalizeAntiEnumTiming } = await import("../../../lib/anti-enum-timing.js");
const { saltRoute } = await import("../../../routes/auth/salt.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/salt", saltRoute);

const VALID_BODY = { email: "user@example.com" };
const REAL_KDF_SALT = "aa".repeat(16); // 32 hex chars (16 bytes)

// ── Tests ────────────────────────────────────────────────────────

describe("POST /salt", () => {
  beforeEach(() => {
    vi.mocked(equalizeAntiEnumTiming).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("account found", () => {
    beforeEach(() => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ kdfSalt: REAL_KDF_SALT }]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as never);
    });

    it("returns 200 with the real kdfSalt", async () => {
      const app = createApp();
      const res = await postJSON(app, "/salt", VALID_BODY);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { kdfSalt: string } };
      expect(body.data.kdfSalt).toBe(REAL_KDF_SALT);
    });

    it("calls equalizeAntiEnumTiming on the found path", async () => {
      const app = createApp();
      await postJSON(app, "/salt", VALID_BODY);

      expect(equalizeAntiEnumTiming).toHaveBeenCalledOnce();
    });
  });

  describe("account not found", () => {
    beforeEach(() => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as never);
    });

    it("returns 200 with a deterministic fake kdfSalt", async () => {
      const app = createApp();
      const res = await postJSON(app, "/salt", VALID_BODY);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { kdfSalt: string } };
      // Must be a non-empty hex string of the right length (PWHASH_SALT_BYTES = 16 bytes = 32 hex)
      expect(body.data.kdfSalt).toMatch(/^[0-9a-f]{32}$/);
    });

    it("returns the same fake salt for the same email (deterministic)", async () => {
      const app = createApp();
      const res1 = await postJSON(app, "/salt", VALID_BODY);
      const res2 = await postJSON(app, "/salt", VALID_BODY);

      const body1 = (await res1.json()) as { data: { kdfSalt: string } };
      const body2 = (await res2.json()) as { data: { kdfSalt: string } };
      expect(body1.data.kdfSalt).toBe(body2.data.kdfSalt);
    });

    it("returns a different fake salt for a different email", async () => {
      const app = createApp();

      // Override hashEmail to return distinct values per call
      const { hashEmail } = await import("../../../lib/email-hash.js");
      vi.mocked(hashEmail).mockReturnValueOnce("hash-a").mockReturnValueOnce("hash-b");

      const res1 = await postJSON(app, "/salt", { email: "a@example.com" });
      const res2 = await postJSON(app, "/salt", { email: "b@example.com" });

      const body1 = (await res1.json()) as { data: { kdfSalt: string } };
      const body2 = (await res2.json()) as { data: { kdfSalt: string } };
      expect(body1.data.kdfSalt).not.toBe(body2.data.kdfSalt);
    });

    it("calls equalizeAntiEnumTiming on the not-found path", async () => {
      const app = createApp();
      await postJSON(app, "/salt", VALID_BODY);

      expect(equalizeAntiEnumTiming).toHaveBeenCalledOnce();
    });
  });

  describe("validation", () => {
    it("returns 400 for missing email", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as never);

      const app = createApp();
      const res = await postJSON(app, "/salt", {});

      expect(res.status).toBe(400);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error).toBeDefined();
    });

    it("returns 400 for invalid email format", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as never);

      const app = createApp();
      const res = await postJSON(app, "/salt", { email: "not-an-email" });

      expect(res.status).toBe(400);
    });
  });
});
