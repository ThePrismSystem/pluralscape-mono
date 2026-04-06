// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoxKeypair, BoxPublicKey, BoxSecretKey } from "@pluralscape/crypto";
import type { BucketId } from "@pluralscape/types";
import type { PropsWithChildren } from "react";

function makeBoxKeypair(): BoxKeypair {
  function assertBoxPublicKey(k: Uint8Array): asserts k is BoxPublicKey {
    if (k.length !== 32) throw new Error("bad key");
  }
  function assertBoxSecretKey(k: Uint8Array): asserts k is BoxSecretKey {
    if (k.length !== 32) throw new Error("bad key");
  }
  const pub = new Uint8Array(32).fill(0xaa);
  const sec = new Uint8Array(32).fill(0xbb);
  assertBoxPublicKey(pub);
  assertBoxSecretKey(sec);
  return { publicKey: pub, secretKey: sec };
}

const FAKE_AEAD_KEY = new Uint8Array(32).fill(0xcc);

const mockMemzero = vi.fn();

class MockDecryptionFailedError extends Error {
  override readonly name = "DecryptionFailedError" as const;
}

class MockInvalidInputError extends Error {
  override readonly name = "InvalidInputError" as const;
}

vi.mock("@pluralscape/crypto", () => ({
  decryptKeyGrant: vi.fn(() => FAKE_AEAD_KEY),
  getSodium: () => ({ memzero: mockMemzero }),
  DecryptionFailedError: MockDecryptionFailedError,
  InvalidInputError: MockInvalidInputError,
  BOX_PUBLIC_KEY_BYTES: 32,
}));

vi.mock("@pluralscape/data/transforms/decode-blob", () => ({
  base64ToUint8Array: vi.fn((b64: string) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }),
  base64urlToUint8Array: vi.fn((b64url: string) => {
    let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (b64.length % 4)) % 4;
    b64 += "=".repeat(padLength);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }),
}));

let queryData: { grants: readonly Record<string, unknown>[] } | undefined;

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    friend: {
      listReceivedKeyGrants: {
        useQuery: () => ({ data: queryData }),
      },
    },
  },
}));

// Dynamic import after mocks are set up
const { BucketKeyProvider, useBucketKeys, useBucketKey } =
  await import("../bucket-key-provider.js");

const TEST_KEYPAIR = makeBoxKeypair();
const TEST_BUCKET_ID = "bucket_test1" as BucketId;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <BucketKeyProvider boxKeypair={TEST_KEYPAIR}>{children}</BucketKeyProvider>
      </QueryClientProvider>
    );
  };
}

describe("BucketKeyProvider", () => {
  beforeEach(() => {
    queryData = undefined;
    vi.clearAllMocks();
  });

  it("returns null while grants are loading", () => {
    queryData = undefined;
    const { result } = renderHook(() => useBucketKeys(), { wrapper: createWrapper() });
    expect(result.current).toBeNull();
  });

  it("returns a map of decrypted keys after load", async () => {
    queryData = {
      grants: [
        {
          id: "kg_1",
          bucketId: TEST_BUCKET_ID,
          encryptedKey: btoa(String.fromCharCode(...new Uint8Array(100))),
          keyVersion: 1,
          grantorSystemId: "sys_friend1",
          senderBoxPublicKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
      ],
    };

    const { result } = renderHook(() => useBucketKeys(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    const entry = result.current?.get(TEST_BUCKET_ID);
    expect(entry).toBeDefined();
    expect(entry?.key).toBe(FAKE_AEAD_KEY);
    expect(entry?.keyVersion).toBe(1);
  });

  it("useBucketKey returns a single entry", async () => {
    queryData = {
      grants: [
        {
          id: "kg_1",
          bucketId: TEST_BUCKET_ID,
          encryptedKey: btoa(String.fromCharCode(...new Uint8Array(100))),
          keyVersion: 2,
          grantorSystemId: "sys_friend1",
          senderBoxPublicKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
      ],
    };

    const { result } = renderHook(() => useBucketKey(TEST_BUCKET_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current?.keyVersion).toBe(2);
  });

  it("skips grants that fail to decrypt with DecryptionFailedError", async () => {
    const { decryptKeyGrant } = await import("@pluralscape/crypto");
    vi.mocked(decryptKeyGrant).mockImplementationOnce(() => {
      throw new MockDecryptionFailedError("wrong key");
    });

    queryData = {
      grants: [
        {
          id: "kg_bad",
          bucketId: "bucket_bad" as BucketId,
          encryptedKey: btoa(String.fromCharCode(...new Uint8Array(100))),
          keyVersion: 1,
          grantorSystemId: "sys_friend1",
          senderBoxPublicKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
      ],
    };

    const { result } = renderHook(() => useBucketKeys(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current?.size).toBe(0);
  });

  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useBucketKeys());
    }).toThrow("useBucketKeys must be used within a BucketKeyProvider");
  });

  it("keeps highest keyVersion when multiple grants exist for same bucket", async () => {
    queryData = {
      grants: [
        {
          id: "kg_1",
          bucketId: TEST_BUCKET_ID,
          encryptedKey: btoa(String.fromCharCode(...new Uint8Array(100))),
          keyVersion: 1,
          grantorSystemId: "sys_friend1",
          senderBoxPublicKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
        {
          id: "kg_2",
          bucketId: TEST_BUCKET_ID,
          encryptedKey: btoa(String.fromCharCode(...new Uint8Array(100))),
          keyVersion: 3,
          grantorSystemId: "sys_friend1",
          senderBoxPublicKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
      ],
    };

    const { result } = renderHook(() => useBucketKeys(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current?.get(TEST_BUCKET_ID)?.keyVersion).toBe(3);
  });

  it("logs unexpected errors via console.warn", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { decryptKeyGrant } = await import("@pluralscape/crypto");
    vi.mocked(decryptKeyGrant).mockImplementationOnce(() => {
      throw new TypeError("unexpected internal error");
    });

    queryData = {
      grants: [
        {
          id: "kg_err",
          bucketId: "bucket_err" as BucketId,
          encryptedKey: btoa(String.fromCharCode(...new Uint8Array(100))),
          keyVersion: 1,
          grantorSystemId: "sys_friend1",
          senderBoxPublicKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
      ],
    };

    const { result } = renderHook(() => useBucketKeys(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current?.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("kg_err"), expect.any(Error));
    warnSpy.mockRestore();
  });

  it("logs warning when senderBoxPublicKey has invalid length", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    queryData = {
      grants: [
        {
          id: "kg_badkey",
          bucketId: TEST_BUCKET_ID,
          encryptedKey: btoa(String.fromCharCode(...new Uint8Array(100))),
          keyVersion: 1,
          grantorSystemId: "sys_friend1",
          senderBoxPublicKey: btoa("short"), // Only 5 bytes, not 32
        },
      ],
    };

    const { result } = renderHook(() => useBucketKeys(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current?.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("kg_badkey"), expect.any(Error));
    warnSpy.mockRestore();
  });

  it("calls memzero on all keys when unmounted", async () => {
    queryData = {
      grants: [
        {
          id: "kg_1",
          bucketId: TEST_BUCKET_ID,
          encryptedKey: btoa(String.fromCharCode(...new Uint8Array(100))),
          keyVersion: 1,
          grantorSystemId: "sys_friend1",
          senderBoxPublicKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
      ],
    };

    const { result, unmount } = renderHook(() => useBucketKeys(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    unmount();

    expect(mockMemzero).toHaveBeenCalledWith(FAKE_AEAD_KEY);
  });
});
