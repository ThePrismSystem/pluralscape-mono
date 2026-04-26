import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis, brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import { decryptCanvas, encryptCanvasUpdate } from "../innerworld-canvas.js";

import { makeBase64Blob } from "./helpers.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  InnerWorldCanvasEncryptedInput,
  InnerWorldCanvasWire,
  SystemId,
} from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

function makeCanvasFields(): InnerWorldCanvasEncryptedInput {
  return {
    viewportX: 100,
    viewportY: 200,
    zoom: 1.5,
    dimensions: { width: 1920, height: 1080 },
  };
}

function makeRawCanvas(overrides?: Partial<InnerWorldCanvasWire>): InnerWorldCanvasWire {
  return {
    systemId: brandId<SystemId>("sys_test"),
    encryptedData: encryptAndEncodeT1(makeCanvasFields(), masterKey),
    version: 1,
    createdAt: toUnixMillis(1_700_000_000_000),
    updatedAt: toUnixMillis(1_700_001_000_000),
    ...overrides,
  };
}

describe("decryptCanvas", () => {
  it("decrypts all canvas fields correctly", () => {
    const result = decryptCanvas(makeRawCanvas(), masterKey);

    expect(result.systemId).toBe("sys_test");
    expect(result.viewportX).toBe(100);
    expect(result.viewportY).toBe(200);
    expect(result.zoom).toBe(1.5);
    expect(result.dimensions).toEqual({ width: 1920, height: 1080 });
  });
});

describe("encryptCanvasUpdate", () => {
  it("includes version in the output", () => {
    const result = encryptCanvasUpdate(makeCanvasFields(), 3, masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(3);
  });

  it("round-trips through decryptCanvas", () => {
    const fields = makeCanvasFields();
    const { encryptedData } = encryptCanvasUpdate(fields, 1, masterKey);
    const raw = makeRawCanvas({ encryptedData });
    const result = decryptCanvas(raw, masterKey);

    expect(result.viewportX).toBe(fields.viewportX);
    expect(result.viewportY).toBe(fields.viewportY);
    expect(result.zoom).toBe(fields.zoom);
    expect(result.dimensions).toEqual(fields.dimensions);
  });
});

describe("decryptCanvas Zod validation", () => {
  it("throws when blob is not an object", () => {
    const raw = makeRawCanvas({ encryptedData: makeBase64Blob("not-object", masterKey) });
    expect(() => decryptCanvas(raw, masterKey)).toThrow(/object/);
  });

  it("throws when viewportX is missing", () => {
    const raw = makeRawCanvas({
      encryptedData: makeBase64Blob(
        { viewportY: 0, zoom: 1, dimensions: { width: 1, height: 1 } },
        masterKey,
      ),
    });
    expect(() => decryptCanvas(raw, masterKey)).toThrow("viewportX");
  });

  it("throws when viewportY is missing", () => {
    const raw = makeRawCanvas({
      encryptedData: makeBase64Blob(
        { viewportX: 0, zoom: 1, dimensions: { width: 1, height: 1 } },
        masterKey,
      ),
    });
    expect(() => decryptCanvas(raw, masterKey)).toThrow("viewportY");
  });

  it("throws when zoom is missing", () => {
    const raw = makeRawCanvas({
      encryptedData: makeBase64Blob(
        { viewportX: 0, viewportY: 0, dimensions: { width: 1, height: 1 } },
        masterKey,
      ),
    });
    expect(() => decryptCanvas(raw, masterKey)).toThrow("zoom");
  });

  it("throws when dimensions is missing", () => {
    const raw = makeRawCanvas({
      encryptedData: makeBase64Blob({ viewportX: 0, viewportY: 0, zoom: 1 }, masterKey),
    });
    expect(() => decryptCanvas(raw, masterKey)).toThrow("dimensions");
  });

  it("throws when dimensions.width is missing", () => {
    const raw = makeRawCanvas({
      encryptedData: makeBase64Blob(
        { viewportX: 0, viewportY: 0, zoom: 1, dimensions: { height: 1 } },
        masterKey,
      ),
    });
    expect(() => decryptCanvas(raw, masterKey)).toThrow("width");
  });

  it("throws when dimensions.height is missing", () => {
    const raw = makeRawCanvas({
      encryptedData: makeBase64Blob(
        { viewportX: 0, viewportY: 0, zoom: 1, dimensions: { width: 1 } },
        masterKey,
      ),
    });
    expect(() => decryptCanvas(raw, masterKey)).toThrow("height");
  });
});
