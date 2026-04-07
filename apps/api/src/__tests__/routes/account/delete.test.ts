import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/account-deletion.service.js", () => ({
  deleteAccount: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { deleteAccount } = await import("../../../services/account-deletion.service.js");
const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /account", () => {
  beforeEach(() => {
    vi.mocked(deleteAccount).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on successful deletion", async () => {
    vi.mocked(deleteAccount).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request("/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "mypassword123" }),
    });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("forwards body, auth, and audit to service", async () => {
    vi.mocked(deleteAccount).mockResolvedValueOnce(undefined);

    const app = createApp();
    await app.request("/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "mypassword123" }),
    });

    expect(vi.mocked(deleteAccount)).toHaveBeenCalledWith(
      {},
      { password: "mypassword123" },
      expect.objectContaining({ accountId: "acct_test001" }),
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: "acct_test001" }),
    );
  });
});
