import { trpc } from "@pluralscape/api-client/trpc";
import {
  BOX_PUBLIC_KEY_BYTES,
  decryptKeyGrant,
  DecryptionFailedError,
  getSodium,
  InvalidInputError,
} from "@pluralscape/crypto";
import {
  base64ToUint8Array,
  base64urlToUint8Array,
} from "@pluralscape/data/transforms/decode-blob";
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
        const encryptedBucketKey = base64ToUint8Array(grant.encryptedKey) as EncryptedKeyGrant;

        const senderBytes = base64urlToUint8Array(grant.senderBoxPublicKey);
        if (senderBytes.length !== BOX_PUBLIC_KEY_BYTES) {
          throw new InvalidInputError(
            `senderBoxPublicKey has invalid length: expected ${String(BOX_PUBLIC_KEY_BYTES)}, got ${String(senderBytes.length)}`,
          );
        }
        const senderPublicKey = senderBytes as BoxPublicKey;

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
      } catch (err) {
        if (err instanceof DecryptionFailedError) {
          // Expected during key rotation or revocation — skip silently
          continue;
        }
        // Unexpected error — log for diagnostics but don't crash the provider
        globalThis.console.warn(
          `BucketKeyProvider: failed to decrypt grant ${grant.id}: ${err instanceof Error ? err.message : "unknown error"}`,
          err,
        );
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
