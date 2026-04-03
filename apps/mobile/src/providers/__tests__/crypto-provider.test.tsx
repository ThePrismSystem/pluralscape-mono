// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CryptoProvider, useMasterKey } from "../crypto-provider.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { PropsWithChildren } from "react";

function makeTestKey(): KdfMasterKey {
  const raw = new Uint8Array(32).fill(0xab);
  // KdfMasterKey is a branded Uint8Array (Uint8Array & { brand }). The brand
  // is a phantom type with no runtime representation, so a correctly-sized
  // Uint8Array satisfies the runtime contract. We use an assertion function to
  // narrow the type without a double-cast.
  function assertKdfMasterKey(key: Uint8Array): asserts key is KdfMasterKey {
    if (key.length !== 32) throw new Error("key must be 32 bytes");
  }
  assertKdfMasterKey(raw);
  return raw;
}

const TEST_KEY = makeTestKey();

function makeWrapper(masterKey: KdfMasterKey | null) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <CryptoProvider masterKey={masterKey}>{children}</CryptoProvider>;
  };
}

describe("useMasterKey", () => {
  it("returns the master key when provided", () => {
    const { result } = renderHook(() => useMasterKey(), {
      wrapper: makeWrapper(TEST_KEY),
    });
    expect(result.current).toBe(TEST_KEY);
  });

  it("returns null when master key is null (locked)", () => {
    const { result } = renderHook(() => useMasterKey(), {
      wrapper: makeWrapper(null),
    });
    expect(result.current).toBeNull();
  });

  it("throws when no CryptoProvider is present", () => {
    expect(() => {
      renderHook(() => useMasterKey());
    }).toThrow("useMasterKey must be used within a CryptoProvider");
  });
});
