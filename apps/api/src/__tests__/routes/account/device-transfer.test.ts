import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse, DeviceTransferRequestId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/device-transfer/initiate.js", () => ({
  initiateTransfer: vi.fn(),
}));

vi.mock("../../../services/device-transfer/complete.js", () => ({
  completeTransfer: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { initiateTransfer } = await import("../../../services/device-transfer/initiate.js");
const { completeTransfer } = await import("../../../services/device-transfer/complete.js");
const {
  TransferValidationError,
  TransferNotFoundError,
  TransferCodeError,
  TransferExpiredError,
  KeyDerivationUnavailableError,
} = await import("../../../services/device-transfer/errors.js");

const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

/** 16-byte salt as 32 hex chars. */
const VALID_SALT_HEX = "aa".repeat(16);

/** Minimal valid encrypted key material: 40 bytes (nonce 24 + tag 16) as 80 hex chars. */
const VALID_ENCRYPTED_HEX = "bb".repeat(40);

/** Valid 10-digit transfer code. */
const VALID_CODE = "1234567890";

// ── Tests ────────────────────────────────────────────────────────

describe("POST /account/device-transfer (initiate)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 on successful initiation", async () => {
    vi.mocked(initiateTransfer).mockResolvedValueOnce({
      transferId: brandId<DeviceTransferRequestId>("dtr_test-id"),
      expiresAt: 1_300_000 as never,
    });

    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer", {
      codeSaltHex: VALID_SALT_HEX,
      encryptedKeyMaterialHex: VALID_ENCRYPTED_HEX,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { transferId: string; expiresAt: number } };
    expect(body.data.transferId).toBe("dtr_test-id");
  });

  it("returns 400 when codeSaltHex is missing", async () => {
    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer", {
      encryptedKeyMaterialHex: VALID_ENCRYPTED_HEX,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when encryptedKeyMaterialHex is missing", async () => {
    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer", {
      codeSaltHex: VALID_SALT_HEX,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when codeSaltHex is wrong length", async () => {
    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer", {
      codeSaltHex: "aa".repeat(8), // 16 hex chars, need 32
      encryptedKeyMaterialHex: VALID_ENCRYPTED_HEX,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when codeSaltHex contains non-hex characters", async () => {
    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer", {
      codeSaltHex: "zz".repeat(16),
      encryptedKeyMaterialHex: VALID_ENCRYPTED_HEX,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when encryptedKeyMaterialHex is too short", async () => {
    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer", {
      codeSaltHex: VALID_SALT_HEX,
      encryptedKeyMaterialHex: "bb".repeat(10), // 20 hex chars, too short
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when encryptedKeyMaterialHex is too long", async () => {
    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer", {
      codeSaltHex: VALID_SALT_HEX,
      encryptedKeyMaterialHex: "bb".repeat(1025), // 2050 hex chars, max is 2048
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when encryptedKeyMaterialHex has odd length", async () => {
    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer", {
      codeSaltHex: VALID_SALT_HEX,
      encryptedKeyMaterialHex: "b".repeat(81), // odd length
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const app = createApp();
    const res = await app.request("/account/device-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when service throws TransferValidationError", async () => {
    vi.mocked(initiateTransfer).mockRejectedValueOnce(
      new TransferValidationError("Invalid code salt length"),
    );

    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer", {
      codeSaltHex: VALID_SALT_HEX,
      encryptedKeyMaterialHex: VALID_ENCRYPTED_HEX,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /account/device-transfer/:id/complete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with encrypted key material on success", async () => {
    vi.mocked(completeTransfer).mockResolvedValueOnce({
      encryptedKeyMaterialHex: "cc".repeat(40),
    });

    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer/dtr_test-id/complete", {
      code: VALID_CODE,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { encryptedKeyMaterialHex: string } };
    expect(body.data.encryptedKeyMaterialHex).toBe("cc".repeat(40));
  });

  it("returns 400 when code is missing", async () => {
    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer/dtr_test-id/complete", {});

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when code is not 8 digits", async () => {
    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer/dtr_test-id/complete", {
      code: "123",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when code contains non-digit characters", async () => {
    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer/dtr_test-id/complete", {
      code: "abcd1234",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when service throws TransferNotFoundError", async () => {
    vi.mocked(completeTransfer).mockRejectedValueOnce(
      new TransferNotFoundError("Transfer request not found or expired"),
    );

    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer/dtr_test-id/complete", {
      code: VALID_CODE,
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 401 when service throws TransferCodeError", async () => {
    vi.mocked(completeTransfer).mockRejectedValueOnce(
      new TransferCodeError("Incorrect transfer code"),
    );

    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer/dtr_test-id/complete", {
      code: VALID_CODE,
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 when service throws TransferExpiredError", async () => {
    vi.mocked(completeTransfer).mockRejectedValueOnce(
      new TransferExpiredError("Too many incorrect attempts"),
    );

    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer/dtr_test-id/complete", {
      code: VALID_CODE,
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 503 when service throws KeyDerivationUnavailableError", async () => {
    vi.mocked(completeTransfer).mockRejectedValueOnce(
      new KeyDerivationUnavailableError("Key derivation service is temporarily unavailable"),
    );

    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer/dtr_test-id/complete", {
      code: VALID_CODE,
    });

    expect(res.status).toBe(503);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const app = createApp();
    const res = await app.request("/account/device-transfer/dtr_test-id/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when service throws TransferValidationError", async () => {
    vi.mocked(completeTransfer).mockRejectedValueOnce(
      new TransferValidationError("Validation failed"),
    );

    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer/dtr_test-id/complete", {
      code: VALID_CODE,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unknown errors as 500", async () => {
    vi.mocked(completeTransfer).mockRejectedValueOnce(new Error("internal failure"));

    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer/dtr_test-id/complete", {
      code: VALID_CODE,
    });

    expect(res.status).toBe(500);
  });
});

describe("POST /account/device-transfer (initiate) — unknown error path", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("re-throws unknown errors as 500", async () => {
    vi.mocked(initiateTransfer).mockRejectedValueOnce(new Error("internal db failure"));

    const app = createApp();
    const res = await postJSON(app, "/account/device-transfer", {
      codeSaltHex: VALID_SALT_HEX,
      encryptedKeyMaterialHex: VALID_ENCRYPTED_HEX,
    });

    expect(res.status).toBe(500);
  });
});
