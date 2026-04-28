import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import { withDecryptedDeviceInfo, type SessionListRow } from "../session-helpers.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { DeviceInfo, SessionId } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

function makeRow(overrides: Partial<SessionListRow> = {}): SessionListRow {
  return {
    id: brandId<SessionId>("sess_test"),
    createdAt: 1000,
    lastActive: 2000,
    expiresAt: 9000,
    encryptedData: null,
    ...overrides,
  };
}

describe("withDecryptedDeviceInfo", () => {
  it("returns deviceInfo when encryptedData is present", () => {
    const info: DeviceInfo = {
      platform: "android",
      appVersion: "2.1.0",
      deviceName: "Pixel 9",
    };
    const encryptedData = encryptAndEncodeT1(info, masterKey);
    const row = makeRow({ encryptedData });

    const result = withDecryptedDeviceInfo(row, masterKey);

    expect(result.deviceInfo).toEqual(info);
    expect(result.id).toBe(row.id);
    expect(result.encryptedData).toBe(encryptedData);
  });

  it("returns deviceInfo=null when encryptedData is null", () => {
    const row = makeRow({ encryptedData: null });

    const result = withDecryptedDeviceInfo(row, masterKey);

    expect(result.deviceInfo).toBeNull();
    expect(result.id).toBe(row.id);
  });

  it("preserves all other row fields", () => {
    const row = makeRow({ createdAt: 5000, lastActive: 6000, expiresAt: 7000 });

    const result = withDecryptedDeviceInfo(row, masterKey);

    expect(result.createdAt).toBe(5000);
    expect(result.lastActive).toBe(6000);
    expect(result.expiresAt).toBe(7000);
  });
});
