import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptAcknowledgement,
  decryptAcknowledgementPage,
  encryptAcknowledgementInput,
  encryptAcknowledgementConfirm,
} from "../acknowledgement.js";
import { encryptAndEncodeT1 } from "../decode-blob.js";

import { makeBase64Blob } from "./helpers.js";

import type { AcknowledgementEncryptedFields } from "../acknowledgement.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { AcknowledgementId, MemberId, SystemId, UnixMillis } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

function makeEncryptedFields(): AcknowledgementEncryptedFields {
  return {
    message: "Please acknowledge this.",
    targetMemberId: "mem_target" as MemberId,
    confirmedAt: null,
  };
}

function makeServerAcknowledgement(
  fields: AcknowledgementEncryptedFields = makeEncryptedFields(),
  overrides?: Partial<{ confirmed: boolean; archived: boolean; archivedAt: UnixMillis | null }>,
) {
  return {
    id: "ack_abc123" as AcknowledgementId,
    systemId: "sys_xyz789" as SystemId,
    createdByMemberId: "mem_creator" as MemberId,
    confirmed: false as boolean,
    encryptedData: encryptAndEncodeT1(fields, masterKey),
    version: 1,
    createdAt: toUnixMillis(1_700_000_000_000),
    updatedAt: toUnixMillis(1_700_001_000_000),
    archived: false as boolean,
    archivedAt: null as UnixMillis | null,
    ...overrides,
  };
}

// ── decryptAcknowledgement ────────────────────────────────────────────

describe("decryptAcknowledgement", () => {
  it("decrypts encryptedData and merges passthrough fields", () => {
    const raw = makeServerAcknowledgement();
    const result = decryptAcknowledgement(raw, masterKey);

    expect(result.id).toBe("ack_abc123");
    expect(result.systemId).toBe("sys_xyz789");
    expect(result.createdByMemberId).toBe("mem_creator");
    expect(result.confirmed).toBe(false);
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_001_000_000);
    expect(result.archived).toBe(false);
    expect(result.message).toBe("Please acknowledge this.");
    expect(result.targetMemberId).toBe("mem_target");
    expect(result.confirmedAt).toBeNull();
  });

  it("handles confirmed acknowledgement with confirmedAt set", () => {
    const confirmedAt = toUnixMillis(1_700_001_500_000);
    const fields: AcknowledgementEncryptedFields = { ...makeEncryptedFields(), confirmedAt };
    const raw = makeServerAcknowledgement(fields, { confirmed: true });
    const result = decryptAcknowledgement(raw, masterKey);

    expect(result.confirmed).toBe(true);
    expect(result.confirmedAt).toBe(confirmedAt);
  });

  it("throws when encryptedData is corrupted", () => {
    const raw = { ...makeServerAcknowledgement(), encryptedData: "not-valid-base64!!!" };
    expect(() => decryptAcknowledgement(raw, masterKey)).toThrow();
  });

  it("returns archived variant when raw.archived is true", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeServerAcknowledgement(makeEncryptedFields(), { archived: true, archivedAt });
    const result = decryptAcknowledgement(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
    expect(result.message).toBe("Please acknowledge this.");
  });

  it("handles archived with null archivedAt", () => {
    const raw = makeServerAcknowledgement(makeEncryptedFields(), {
      archived: true,
      archivedAt: null,
    });
    const result = decryptAcknowledgement(raw, masterKey);
    expect(result.archived).toBe(true);
    expect(result.archivedAt).toBeNull();
  });
});

// ── decryptAcknowledgementPage ────────────────────────────────────────

describe("decryptAcknowledgementPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const data = [makeServerAcknowledgement(), makeServerAcknowledgement()];
    const result = decryptAcknowledgementPage({ data, nextCursor: "cursor-token" }, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor-token");
    result.data.forEach((a) => {
      expect(a.message).toBe("Please acknowledge this.");
    });
  });

  it("handles null cursor", () => {
    const result = decryptAcknowledgementPage(
      { data: [makeServerAcknowledgement()], nextCursor: null },
      masterKey,
    );
    expect(result.nextCursor).toBeNull();
  });

  it("handles empty data array", () => {
    const result = decryptAcknowledgementPage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

// ── encryptAcknowledgementInput ───────────────────────────────────────

describe("encryptAcknowledgementInput", () => {
  it("returns an object with an encryptedData string", () => {
    const result = encryptAcknowledgementInput(makeEncryptedFields(), masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: encrypt then decrypt returns original fields", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptAcknowledgementInput(fields, masterKey);
    const result = decryptAcknowledgement(
      { ...makeServerAcknowledgement(), encryptedData },
      masterKey,
    );
    expect(result.message).toBe(fields.message);
    expect(result.targetMemberId).toBe(fields.targetMemberId);
    expect(result.confirmedAt).toBeNull();
  });

  it("produces different ciphertext on each call", () => {
    const r1 = encryptAcknowledgementInput(makeEncryptedFields(), masterKey);
    const r2 = encryptAcknowledgementInput(makeEncryptedFields(), masterKey);
    expect(r1.encryptedData).not.toBe(r2.encryptedData);
  });
});

// ── encryptAcknowledgementConfirm ─────────────────────────────────────

describe("encryptAcknowledgementConfirm", () => {
  it("returns an object with an encryptedData string", () => {
    const confirmedAt = toUnixMillis(1_700_001_500_000);
    const fields: AcknowledgementEncryptedFields = { ...makeEncryptedFields(), confirmedAt };
    const result = encryptAcknowledgementConfirm(fields, masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips with confirmedAt set through decryptAcknowledgement", () => {
    const confirmedAt = toUnixMillis(1_700_001_500_000);
    const fields: AcknowledgementEncryptedFields = { ...makeEncryptedFields(), confirmedAt };
    const { encryptedData } = encryptAcknowledgementConfirm(fields, masterKey);
    const result = decryptAcknowledgement(
      { ...makeServerAcknowledgement(), encryptedData, confirmed: true },
      masterKey,
    );
    expect(result.message).toBe(fields.message);
    expect(result.targetMemberId).toBe(fields.targetMemberId);
    expect(result.confirmedAt).toBe(confirmedAt);
  });

  it("produces different ciphertext on each call", () => {
    const fields: AcknowledgementEncryptedFields = {
      ...makeEncryptedFields(),
      confirmedAt: toUnixMillis(1_700_001_500_000),
    };
    const r1 = encryptAcknowledgementConfirm(fields, masterKey);
    const r2 = encryptAcknowledgementConfirm(fields, masterKey);
    expect(r1.encryptedData).not.toBe(r2.encryptedData);
  });
});

// ── assertAcknowledgementEncryptedFields ──────────────────────────────

describe("assertAcknowledgementEncryptedFields", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = {
      ...makeServerAcknowledgement(),
      encryptedData: makeBase64Blob("not-an-object", masterKey),
    };
    expect(() => decryptAcknowledgement(raw, masterKey)).toThrow("not an object");
  });

  it("throws when blob is missing message field", () => {
    const raw = {
      ...makeServerAcknowledgement(),
      encryptedData: makeBase64Blob({ targetMemberId: "mem_target" }, masterKey),
    };
    expect(() => decryptAcknowledgement(raw, masterKey)).toThrow(
      "missing required string field: message",
    );
  });

  it("throws when message is not a string", () => {
    const raw = {
      ...makeServerAcknowledgement(),
      encryptedData: makeBase64Blob({ message: 42, targetMemberId: "mem_target" }, masterKey),
    };
    expect(() => decryptAcknowledgement(raw, masterKey)).toThrow(
      "missing required string field: message",
    );
  });

  it("throws when blob is missing targetMemberId field", () => {
    const raw = {
      ...makeServerAcknowledgement(),
      encryptedData: makeBase64Blob({ message: "Please acknowledge this." }, masterKey),
    };
    expect(() => decryptAcknowledgement(raw, masterKey)).toThrow(
      "missing required string field: targetMemberId",
    );
  });

  it("throws when targetMemberId is not a string", () => {
    const raw = {
      ...makeServerAcknowledgement(),
      encryptedData: makeBase64Blob(
        { message: "Please acknowledge this.", targetMemberId: 99 },
        masterKey,
      ),
    };
    expect(() => decryptAcknowledgement(raw, masterKey)).toThrow(
      "missing required string field: targetMemberId",
    );
  });
});
