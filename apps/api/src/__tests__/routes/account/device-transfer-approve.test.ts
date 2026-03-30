import { afterEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/device-transfer.service.js", () => ({
  initiateTransfer: vi.fn(),
  completeTransfer: vi.fn(),
  approveTransfer: vi.fn(),
  TransferValidationError: class TransferValidationError extends Error {
    override readonly name = "TransferValidationError" as const;
  },
  TransferNotFoundError: class TransferNotFoundError extends Error {
    override readonly name = "TransferNotFoundError" as const;
  },
  TransferCodeError: class TransferCodeError extends Error {
    override readonly name = "TransferCodeError" as const;
  },
  TransferExpiredError: class TransferExpiredError extends Error {
    override readonly name = "TransferExpiredError" as const;
  },
  TransferSessionMismatchError: class TransferSessionMismatchError extends Error {
    override readonly name = "TransferSessionMismatchError" as const;
  },
  KeyDerivationUnavailableError: class KeyDerivationUnavailableError extends Error {
    override readonly name = "KeyDerivationUnavailableError" as const;
  },
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { approveTransfer, TransferNotFoundError, TransferSessionMismatchError } =
  await import("../../../services/device-transfer.service.js");

const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("POST /account/device-transfer/:id/approve", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on successful approval", async () => {
    vi.mocked(approveTransfer).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request("/account/device-transfer/dtr_test-id/approve", {
      method: "POST",
    });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("calls approveTransfer with correct arguments", async () => {
    vi.mocked(approveTransfer).mockResolvedValueOnce(undefined);

    const app = createApp();
    await app.request("/account/device-transfer/dtr_test-id/approve", {
      method: "POST",
    });

    expect(vi.mocked(approveTransfer)).toHaveBeenCalledWith(
      expect.anything(),
      "dtr_test-id",
      "acct_test",
      "sess_test",
      expect.any(Function),
    );
  });

  it("returns 404 when service throws TransferNotFoundError", async () => {
    vi.mocked(approveTransfer).mockRejectedValueOnce(
      new TransferNotFoundError("Transfer request not found or expired"),
    );

    const app = createApp();
    const res = await app.request("/account/device-transfer/dtr_test-id/approve", {
      method: "POST",
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 403 when service throws TransferSessionMismatchError", async () => {
    vi.mocked(approveTransfer).mockRejectedValueOnce(
      new TransferSessionMismatchError("Only the initiating session may approve this transfer"),
    );

    const app = createApp();
    const res = await app.request("/account/device-transfer/dtr_test-id/approve", {
      method: "POST",
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
