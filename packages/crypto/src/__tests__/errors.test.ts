import { describe, expect, it } from "vitest";

import {
  AlreadyInitializedError,
  CryptoNotReadyError,
  DecryptionFailedError,
  UnsupportedOperationError,
} from "../errors.js";

describe("CryptoNotReadyError", () => {
  it("has the correct name property", () => {
    const error = new CryptoNotReadyError();
    expect(error.name).toBe("CryptoNotReadyError");
  });

  it("is an instance of Error", () => {
    const error = new CryptoNotReadyError();
    expect(error).toBeInstanceOf(Error);
  });

  it("has a descriptive message", () => {
    const error = new CryptoNotReadyError();
    expect(error.message).toContain("initSodium()");
  });
});

describe("DecryptionFailedError", () => {
  it("has the correct name property", () => {
    const error = new DecryptionFailedError();
    expect(error.name).toBe("DecryptionFailedError");
  });

  it("is an instance of Error", () => {
    const error = new DecryptionFailedError();
    expect(error).toBeInstanceOf(Error);
  });

  it("accepts a custom message", () => {
    const error = new DecryptionFailedError("custom reason");
    expect(error.message).toBe("custom reason");
  });
});

describe("AlreadyInitializedError", () => {
  it("has the correct name property", () => {
    const error = new AlreadyInitializedError();
    expect(error.name).toBe("AlreadyInitializedError");
  });

  it("is an instance of Error", () => {
    const error = new AlreadyInitializedError();
    expect(error).toBeInstanceOf(Error);
  });
});

describe("UnsupportedOperationError", () => {
  it("has the correct name property", () => {
    const error = new UnsupportedOperationError("signSeedKeypair", "react-native");
    expect(error.name).toBe("UnsupportedOperationError");
  });

  it("includes operation and platform in message", () => {
    const error = new UnsupportedOperationError("signSeedKeypair", "react-native");
    expect(error.message).toContain("signSeedKeypair");
    expect(error.message).toContain("react-native");
  });
});
