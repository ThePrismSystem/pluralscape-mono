import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import { decryptDeviceInfo } from "../session.js";

import { makeBase64Blob } from "./helpers.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { DeviceInfo } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

describe("decryptDeviceInfo", () => {
  it("decrypts a valid DeviceInfo plaintext", () => {
    const info: DeviceInfo = {
      platform: "ios",
      appVersion: "1.0.0",
      deviceName: "iPhone 15 Pro",
    };
    const encryptedData = encryptAndEncodeT1(info, masterKey);
    const result = decryptDeviceInfo(encryptedData, masterKey);
    expect(result).toEqual(info);
  });

  it("throws when plaintext is missing required fields", () => {
    const encryptedData = makeBase64Blob({ platform: "ios" }, masterKey);
    expect(() => decryptDeviceInfo(encryptedData, masterKey)).toThrow();
  });

  it("throws when plaintext is not an object", () => {
    const encryptedData = makeBase64Blob("just-a-string", masterKey);
    expect(() => decryptDeviceInfo(encryptedData, masterKey)).toThrow();
  });

  it("throws on invalid base64", () => {
    expect(() => decryptDeviceInfo("!!!", masterKey)).toThrow();
  });
});
