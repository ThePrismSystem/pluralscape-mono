/**
 * Argon2id context profile selection (ADR 037).
 *
 * Verifies each callsite drives the libsodium `pwhash` / `pwhashStr` adapter
 * with the profile appropriate for its context:
 *
 *   - device-transfer → ARGON2ID_PROFILE_TRANSFER   (t=3, m=32 MiB)
 *   - auth-key split  → ARGON2ID_PROFILE_MASTER_KEY (t=4, m=64 MiB)
 *   - PIN hashing     → ARGON2ID_PROFILE_MASTER_KEY (t=4, m=64 MiB)
 *
 * The assertions peek at the adapter spy arguments rather than comparing key
 * outputs, because a key-output comparison would re-run Argon2id for each
 * parameter combination and balloon test time on CI.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ARGON2ID_PROFILE_MASTER_KEY,
  ARGON2ID_PROFILE_TRANSFER,
  PWHASH_SALT_BYTES,
  assertArgon2idProfile,
} from "../crypto.constants.js";
import { deriveTransferKey, generateTransferCode } from "../device-transfer.js";
import { hashPin } from "../pin.js";
import { getSodium } from "../sodium.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { PwhashSalt } from "../types.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

describe("Argon2id profile wiring", () => {
  it("device-transfer uses the TRANSFER profile", () => {
    const sodium = getSodium();
    const pwhashSpy = vi.spyOn(sodium, "pwhash");
    try {
      const { verificationCode, codeSalt } = generateTransferCode();
      deriveTransferKey(verificationCode, codeSalt);

      expect(pwhashSpy).toHaveBeenCalledTimes(1);
      const callArgs = pwhashSpy.mock.calls[0];
      if (!callArgs) throw new Error("pwhash spy recorded no calls");
      // Signature: pwhash(outLen, password, salt, opslimit, memlimit)
      expect(callArgs[3]).toBe(ARGON2ID_PROFILE_TRANSFER.opslimit);
      expect(callArgs[4]).toBe(ARGON2ID_PROFILE_TRANSFER.memlimit);
    } finally {
      pwhashSpy.mockRestore();
    }
  });

  it("auth-key derivation uses the MASTER_KEY profile", async () => {
    const sodium = getSodium();
    const pwhashSpy = vi.spyOn(sodium, "pwhash");
    try {
      // Import lazily so the spy is in place before the adapter is touched.
      const { deriveAuthAndPasswordKeys } = await import("../auth-key.js");
      const password = new TextEncoder().encode("correct horse battery staple");
      const salt = sodium.randomBytes(PWHASH_SALT_BYTES) as PwhashSalt;
      await deriveAuthAndPasswordKeys(password, salt);

      expect(pwhashSpy).toHaveBeenCalledTimes(1);
      const callArgs = pwhashSpy.mock.calls[0];
      if (!callArgs) throw new Error("pwhash spy recorded no calls");
      expect(callArgs[3]).toBe(ARGON2ID_PROFILE_MASTER_KEY.opslimit);
      expect(callArgs[4]).toBe(ARGON2ID_PROFILE_MASTER_KEY.memlimit);
    } finally {
      pwhashSpy.mockRestore();
    }
  });

  it("PIN hashing uses the MASTER_KEY profile", () => {
    const sodium = getSodium();
    const pwhashStrSpy = vi.spyOn(sodium, "pwhashStr");
    try {
      hashPin("1234567890");

      expect(pwhashStrSpy).toHaveBeenCalledTimes(1);
      const callArgs = pwhashStrSpy.mock.calls[0];
      if (!callArgs) throw new Error("pwhashStr spy recorded no calls");
      // Signature: pwhashStr(password, opslimit, memlimit)
      expect(callArgs[1]).toBe(ARGON2ID_PROFILE_MASTER_KEY.opslimit);
      expect(callArgs[2]).toBe(ARGON2ID_PROFILE_MASTER_KEY.memlimit);
    } finally {
      pwhashStrSpy.mockRestore();
    }
  });

  it("TRANSFER and MASTER_KEY produce different keys from the same password+salt", () => {
    const sodium = getSodium();
    const password = new TextEncoder().encode("same-password");
    const salt = sodium.randomBytes(PWHASH_SALT_BYTES) as PwhashSalt;

    const transferKey = sodium.pwhash(
      32,
      password,
      salt,
      ARGON2ID_PROFILE_TRANSFER.opslimit,
      ARGON2ID_PROFILE_TRANSFER.memlimit,
    );
    const masterKey = sodium.pwhash(
      32,
      password,
      salt,
      ARGON2ID_PROFILE_MASTER_KEY.opslimit,
      ARGON2ID_PROFILE_MASTER_KEY.memlimit,
    );

    expect(transferKey).not.toEqual(masterKey);
  });
});

describe("Argon2id profile invariants", () => {
  it("MASTER_KEY profile is frozen against runtime mutation", () => {
    "use strict";
    expect(() => {
      (ARGON2ID_PROFILE_MASTER_KEY as { opslimit: number }).opslimit = 99;
    }).toThrow(TypeError);
  });

  it("TRANSFER profile is frozen against runtime mutation", () => {
    "use strict";
    expect(() => {
      (ARGON2ID_PROFILE_TRANSFER as { memlimit: number }).memlimit = 1;
    }).toThrow(TypeError);
  });
});

describe("assertArgon2idProfile", () => {
  it("accepts both shipped profiles", () => {
    expect(() => {
      assertArgon2idProfile(ARGON2ID_PROFILE_MASTER_KEY);
    }).not.toThrow();
    expect(() => {
      assertArgon2idProfile(ARGON2ID_PROFILE_TRANSFER);
    }).not.toThrow();
  });

  it("rejects null and non-object inputs", () => {
    expect(() => {
      assertArgon2idProfile(null);
    }).toThrow(TypeError);
    expect(() => {
      assertArgon2idProfile("profile");
    }).toThrow(TypeError);
    expect(() => {
      assertArgon2idProfile(42);
    }).toThrow(TypeError);
  });

  it("rejects profiles with non-integer opslimit", () => {
    expect(() => {
      assertArgon2idProfile({ opslimit: 1.5, memlimit: 64 * 1_024 * 1_024 });
    }).toThrow(TypeError);
  });

  it("rejects profiles with opslimit < 1", () => {
    expect(() => {
      assertArgon2idProfile({ opslimit: 0, memlimit: 64 * 1_024 * 1_024 });
    }).toThrow(TypeError);
    expect(() => {
      assertArgon2idProfile({ opslimit: -1, memlimit: 64 * 1_024 * 1_024 });
    }).toThrow(TypeError);
  });

  it("rejects profiles below the OWASP memlimit floor (19 MiB)", () => {
    expect(() => {
      assertArgon2idProfile({ opslimit: 3, memlimit: 1024 });
    }).toThrow(TypeError);
    expect(() => {
      assertArgon2idProfile({ opslimit: 3, memlimit: 8 * 1_024 * 1_024 });
    }).toThrow(TypeError);
  });

  it("rejects profiles missing required numeric fields", () => {
    expect(() => {
      assertArgon2idProfile({ opslimit: 3 });
    }).toThrow(TypeError);
    expect(() => {
      assertArgon2idProfile({ memlimit: 64 * 1_024 * 1_024 });
    }).toThrow(TypeError);
  });
});
