import { trpc } from "@pluralscape/api-client/trpc";
import { decryptKeyGrant, getSodium } from "@pluralscape/crypto";
import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";

import type { AeadKey, BoxKeypair, BoxPublicKey, EncryptedKeyGrant } from "@pluralscape/crypto";
import type { BucketId } from "@pluralscape/types";
import type { PropsWithChildren } from "react";

/** Cached decrypted bucket key entry. */
export interface BucketKeyEntry {
  readonly key: AeadKey;
  readonly keyVersion: number;
}

const MISSING_PROVIDER = "useBucketKeys must be used within a BucketKeyProvider";

interface BucketKeyContextValue {
  readonly keys: Map<BucketId, BucketKeyEntry> | null;
}

const BucketKeyContext = createContext<BucketKeyContextValue | null>(null);

/** Standard base64 string to Uint8Array. */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Base64url (no padding) to Uint8Array. */
function base64urlToBytes(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (b64.length % 4)) % 4;
  b64 += "=".repeat(padLength);
  return base64ToBytes(b64);
}

interface BucketKeyProviderProps extends PropsWithChildren {
  readonly boxKeypair: BoxKeypair;
}

export function BucketKeyProvider({
  boxKeypair,
  children,
}: BucketKeyProviderProps): React.JSX.Element {
  const keysRef = useRef(new Map<BucketId, BucketKeyEntry>());
  const { data } = trpc.friend.listReceivedKeyGrants.useQuery(undefined);

  const keyMap = useMemo(() => {
    if (!data) return null;

    const nextMap = new Map<BucketId, BucketKeyEntry>();

    for (const grant of data.grants) {
      try {
        const encryptedBucketKey = base64ToBytes(grant.encryptedKey) as EncryptedKeyGrant;
        const senderPublicKey = base64urlToBytes(grant.senderBoxPublicKey) as BoxPublicKey;

        const aeadKey = decryptKeyGrant({
          encryptedBucketKey,
          bucketId: grant.bucketId,
          keyVersion: grant.keyVersion,
          senderPublicKey,
          recipientSecretKey: boxKeypair.secretKey,
        });

        const existing = nextMap.get(grant.bucketId);
        if (!existing || grant.keyVersion > existing.keyVersion) {
          nextMap.set(grant.bucketId, { key: aeadKey, keyVersion: grant.keyVersion });
        }
      } catch {
        // Key rotation or revocation may cause valid decrypt failures — skip silently
      }
    }

    keysRef.current = nextMap;
    return nextMap;
  }, [data, boxKeypair.secretKey]);

  const contextValue = useMemo<BucketKeyContextValue>(() => ({ keys: keyMap }), [keyMap]);

  useEffect(() => {
    return () => {
      const sodium = getSodium();
      for (const entry of keysRef.current.values()) {
        sodium.memzero(entry.key);
      }
      keysRef.current.clear();
    };
  }, []);

  return <BucketKeyContext.Provider value={contextValue}>{children}</BucketKeyContext.Provider>;
}

/** Returns the full map of decrypted bucket keys, or null while loading. */
export function useBucketKeys(): Map<BucketId, BucketKeyEntry> | null {
  const ctx = useContext(BucketKeyContext);
  if (ctx === null) {
    throw new Error(MISSING_PROVIDER);
  }
  return ctx.keys;
}

/** Returns a single decrypted bucket key entry, or undefined if not available. */
export function useBucketKey(bucketId: BucketId): BucketKeyEntry | undefined {
  const keys = useBucketKeys();
  return keys?.get(bucketId);
}
