import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  KeyLifecycleManager,
  KeyLifecycleState,
  NativeMemzero,
  SecurityPresetLevel,
} from "../lifecycle-types.js";
import type { AeadKey, BoxKeypair, KdfMasterKey, KeyVersion, SignKeypair } from "../types.js";
import type { BucketId } from "@pluralscape/types";

describe("KeyLifecycleState", () => {
  it("accepts valid states", () => {
    assertType<KeyLifecycleState>("terminated");
    assertType<KeyLifecycleState>("locked");
    assertType<KeyLifecycleState>("unlocked");
    assertType<KeyLifecycleState>("grace");
  });

  it("rejects invalid states", () => {
    // @ts-expect-error invalid state
    assertType<KeyLifecycleState>("active");
  });

  it("is exhaustive in a switch", () => {
    function handleState(state: KeyLifecycleState): string {
      switch (state) {
        case "terminated":
        case "locked":
        case "unlocked":
        case "grace":
          return state;
        default: {
          const _exhaustive: never = state;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleState).toBeFunction();
  });
});

describe("SecurityPresetLevel", () => {
  it("accepts valid levels", () => {
    assertType<SecurityPresetLevel>("convenience");
    assertType<SecurityPresetLevel>("standard");
    assertType<SecurityPresetLevel>("paranoid");
  });

  it("rejects invalid levels", () => {
    // @ts-expect-error invalid preset level
    assertType<SecurityPresetLevel>("maximum");
  });

  it("is exhaustive in a switch", () => {
    function handleLevel(level: SecurityPresetLevel): string {
      switch (level) {
        case "convenience":
        case "standard":
        case "paranoid":
          return level;
        default: {
          const _exhaustive: never = level;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleLevel).toBeFunction();
  });
});

describe("KeyLifecycleManager", () => {
  it("has state as KeyLifecycleState", () => {
    expectTypeOf<KeyLifecycleManager["state"]>().toEqualTypeOf<KeyLifecycleState>();
  });

  it("getMasterKey returns KdfMasterKey", () => {
    type GetMasterKey = KeyLifecycleManager["getMasterKey"];
    expectTypeOf<ReturnType<GetMasterKey>>().toEqualTypeOf<KdfMasterKey>();
  });

  it("getIdentityKeys returns sign and box keypairs", () => {
    type GetIdentityKeys = KeyLifecycleManager["getIdentityKeys"];
    type Result = ReturnType<GetIdentityKeys>;
    expectTypeOf<Result["sign"]>().toEqualTypeOf<SignKeypair>();
    expectTypeOf<Result["box"]>().toEqualTypeOf<BoxKeypair>();
  });

  it("getBucketKey accepts bucketId, encryptedKey, and keyVersion", () => {
    type GetBucketKey = KeyLifecycleManager["getBucketKey"];
    expectTypeOf<GetBucketKey>().toBeCallableWith(
      "" as BucketId,
      new Uint8Array(),
      1 as KeyVersion,
    );
    expectTypeOf<ReturnType<GetBucketKey>>().toEqualTypeOf<AeadKey>();
  });

  it("lock returns Promise<void>", () => {
    type Lock = KeyLifecycleManager["lock"];
    expectTypeOf<ReturnType<Lock>>().toEqualTypeOf<Promise<void>>();
  });
});

describe("NativeMemzero", () => {
  it("memzero accepts Uint8Array and returns void", () => {
    type Memzero = NativeMemzero["memzero"];
    expectTypeOf<Memzero>().toBeCallableWith(new Uint8Array());
    expectTypeOf<ReturnType<Memzero>>().toBeVoid();
  });
});
