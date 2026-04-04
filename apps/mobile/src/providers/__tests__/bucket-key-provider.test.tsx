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

vi.mock("@pluralscape/crypto", () => ({
  decryptKeyGrant: vi.fn(() => FAKE_AEAD_KEY),
  getSodium: () => ({ memzero: mockMemzero }),
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

  it("skips grants that fail to decrypt", async () => {
    const { decryptKeyGrant } = await import("@pluralscape/crypto");
    vi.mocked(decryptKeyGrant).mockImplementationOnce(() => {
      throw new Error("decryption failed");
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
});
