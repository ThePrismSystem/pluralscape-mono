import { describe, expect, it } from "vitest";

import {
  AlreadyInitializedError,
  BiometricFailedError,
  CryptoError,
  CryptoNotReadyError,
  DecryptionFailedError,
  InvalidInputError,
  InvalidStateTransitionError,
  KeysLockedError,
  KeyStorageFailedError,
  SignatureVerificationError,
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

  it("accepts a custom message", () => {
    const error = new CryptoNotReadyError("custom init failure");
    expect(error.message).toBe("custom init failure");
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

  it("propagates cause via ErrorOptions", () => {
    const original = new Error("libsodium internal error");
    const error = new DecryptionFailedError(undefined, { cause: original });
    expect(error.cause).toBe(original);
  });
});

describe("InvalidInputError", () => {
  it("has the correct name property", () => {
    const error = new InvalidInputError("bad input");
    expect(error.name).toBe("InvalidInputError");
  });

  it("is an instance of Error", () => {
    const error = new InvalidInputError("bad input");
    expect(error).toBeInstanceOf(Error);
  });

  it("contains the provided message", () => {
    const error = new InvalidInputError("key must be 32 bytes");
    expect(error.message).toBe("key must be 32 bytes");
  });

  it("has a default message", () => {
    const error = new InvalidInputError();
    expect(error.message).toContain("Invalid");
  });

  it("propagates cause via ErrorOptions", () => {
    const original = new TypeError("bad length");
    const error = new InvalidInputError("wrong size", { cause: original });
    expect(error.cause).toBe(original);
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

describe("KeysLockedError", () => {
  it("has the correct name property", () => {
    const error = new KeysLockedError();
    expect(error.name).toBe("KeysLockedError");
  });

  it("is an instance of Error", () => {
    const error = new KeysLockedError();
    expect(error).toBeInstanceOf(Error);
  });

  it("has a default message", () => {
    const error = new KeysLockedError();
    expect(error.message).toContain("locked");
  });
});

describe("KeyStorageFailedError", () => {
  it("has the correct name property", () => {
    const original = new Error("store unavailable");
    const error = new KeyStorageFailedError("Secure store write failed", { cause: original });
    expect(error.name).toBe("KeyStorageFailedError");
  });

  it("is an instance of Error", () => {
    const original = new Error("store unavailable");
    const error = new KeyStorageFailedError("Secure store write failed", { cause: original });
    expect(error).toBeInstanceOf(Error);
  });

  it("propagates cause via ErrorOptions", () => {
    const original = new Error("store unavailable");
    const error = new KeyStorageFailedError("Secure store write failed", { cause: original });
    expect(error.cause).toBe(original);
  });
});

describe("BiometricFailedError", () => {
  it("has the correct name property", () => {
    const error = new BiometricFailedError(true);
    expect(error.name).toBe("BiometricFailedError");
  });

  it("is an instance of Error", () => {
    const error = new BiometricFailedError(false);
    expect(error).toBeInstanceOf(Error);
  });

  it("reports retries exhausted when true", () => {
    const error = new BiometricFailedError(true);
    expect(error.retriesExhausted).toBe(true);
  });

  it("reports retries not exhausted when false", () => {
    const error = new BiometricFailedError(false);
    expect(error.retriesExhausted).toBe(false);
  });
});

describe("CryptoError base class", () => {
  it("has the correct name property", () => {
    const error = new CryptoError();
    expect(error.name).toBe("CryptoError");
  });

  it("is an instance of Error", () => {
    const error = new CryptoError();
    expect(error).toBeInstanceOf(Error);
  });

  it("accepts a custom message", () => {
    const error = new CryptoError("custom crypto failure");
    expect(error.message).toBe("custom crypto failure");
  });

  it("all subclasses are instanceof CryptoError", () => {
    expect(new CryptoNotReadyError()).toBeInstanceOf(CryptoError);
    expect(new DecryptionFailedError()).toBeInstanceOf(CryptoError);
    expect(new InvalidInputError()).toBeInstanceOf(CryptoError);
    expect(new AlreadyInitializedError()).toBeInstanceOf(CryptoError);
    expect(new UnsupportedOperationError("op", "platform")).toBeInstanceOf(CryptoError);
    expect(new KeysLockedError()).toBeInstanceOf(CryptoError);
    expect(new KeyStorageFailedError()).toBeInstanceOf(CryptoError);
    expect(new SignatureVerificationError()).toBeInstanceOf(CryptoError);
    expect(new InvalidStateTransitionError("unlocked", "locked")).toBeInstanceOf(CryptoError);
    expect(new BiometricFailedError(false)).toBeInstanceOf(CryptoError);
  });

  it("subclasses are also instanceof Error", () => {
    expect(new DecryptionFailedError("x")).toBeInstanceOf(Error);
    expect(new InvalidInputError("x")).toBeInstanceOf(Error);
  });
});
