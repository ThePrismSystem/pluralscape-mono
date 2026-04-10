/**
 * In-memory `Persister` implementation for tests.
 *
 * Stores every upserted entity keyed by `entityType:sourceEntityId` and
 * records every error without throwing. Two contract details matter for
 * tests:
 *
 * 1. **Content-identical re-upserts return `action: "skipped"`.** The engine
 *    reports skipped work through its progress counters; a real persister
 *    consults `import_entity_refs` and a content hash before writing, and the
 *    fake must mirror that behaviour so engine tests can assert on skip
 *    counts without hitting I/O.
 *
 * 2. **`pluralscapeEntityId` is deterministic per `(entityType, sourceEntityId)`.**
 *    We hash the key with SHA-256 and take a short prefix, so two independent
 *    persister instances produce the same ID for the same key. Tests can
 *    therefore pin expected IDs without a running counter — and a checkpoint
 *    resume run still sees the same IDs as the prior run would have assigned.
 *
 * Additionally, `throwOn` injects per-entity failures for the engine's
 * error-path tests. Each spec matches by `(entityType, sourceEntityId)` and
 * re-throws the supplied error. A spec marked `once: true` is consumed after
 * the first match; otherwise every call matching the spec throws.
 */
import { createHash } from "node:crypto";

import type {
  PersistableEntity,
  PersistableEntityType,
  Persister,
  PersisterUpsertResult,
} from "../../persistence/persister.types.js";
import type { ImportEntityType, ImportError } from "@pluralscape/types";

/** Length of the SHA-256 hex prefix used as the deterministic ID. */
const DETERMINISTIC_ID_LENGTH = 26;

/** A single entity stored in the in-memory persister. */
export interface StoredEntity {
  readonly entityType: ImportEntityType;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
  readonly payload: unknown;
}

/** Snapshot of the in-memory persister's state for test assertions. */
export interface InMemoryPersisterSnapshot {
  readonly size: number;
  readonly entities: readonly StoredEntity[];
  readonly errors: readonly ImportError[];
  readonly flushCount: number;
  /** Count entities of a given type. */
  readonly countByType: (entityType: ImportEntityType) => number;
  /** True iff at least one entity of the given type was upserted. */
  readonly hasType: (entityType: ImportEntityType) => boolean;
  /** Lookup a single stored entity by type and source id. */
  readonly find: (entityType: ImportEntityType, sourceEntityId: string) => StoredEntity | undefined;
}

/** Spec for injecting an error into a specific upsert call. */
export interface ThrowOnSpec {
  readonly entityType: PersistableEntityType;
  readonly sourceEntityId: string;
  /**
   * Hint describing whether the injected failure should be treated as fatal
   * by the engine. The persister itself simply re-throws `error`; the engine
   * classifies the thrown value and reacts accordingly. This field is part of
   * the spec so test authors can document intent at the call site and so the
   * helper can emit an `Error` with a `fatal` own-property when the supplied
   * error does not already carry one.
   */
  readonly fatal: boolean;
  readonly error: Error;
  /** When `true`, the spec is consumed after the first matching call. */
  readonly once?: boolean;
}

/** Options for creating an in-memory persister. */
export interface InMemoryPersisterOptions {
  readonly throwOn?: readonly ThrowOnSpec[];
}

/** Return value of `createInMemoryPersister`. */
export interface InMemoryPersister {
  readonly persister: Persister;
  readonly snapshot: () => InMemoryPersisterSnapshot;
}

interface StoredInternal {
  readonly pluralscapeEntityId: string;
  readonly payloadHash: string;
  readonly payload: unknown;
}

function storageKey(entityType: ImportEntityType, sourceEntityId: string): string {
  return `${entityType}:${sourceEntityId}`;
}

function deterministicId(entityType: ImportEntityType, sourceEntityId: string): string {
  return createHash("sha256")
    .update(storageKey(entityType, sourceEntityId))
    .digest("hex")
    .slice(0, DETERMINISTIC_ID_LENGTH);
}

function hashPayload(payload: unknown): string {
  // JSON.stringify returns `undefined` only for values we never pass here
  // (undefined, symbols, functions at the top level); fall back to the
  // literal "null" to keep the hash stable if a caller ever does.
  const serialized = JSON.stringify(payload);
  return createHash("sha256")
    .update(typeof serialized === "string" ? serialized : "null")
    .digest("hex");
}

/**
 * Build a fresh in-memory persister. Each call returns an isolated instance so
 * tests can share the helper without interfering with one another.
 */
export function createInMemoryPersister(options: InMemoryPersisterOptions = {}): InMemoryPersister {
  const store = new Map<string, StoredInternal>();
  const errors: ImportError[] = [];
  let flushCount = 0;
  const throwSpecs: ThrowOnSpec[] = [...(options.throwOn ?? [])];
  const consumedOnceKeys = new Set<string>();

  function matchThrowSpec(entity: PersistableEntity): ThrowOnSpec | undefined {
    for (const spec of throwSpecs) {
      if (spec.entityType !== entity.entityType) continue;
      if (spec.sourceEntityId !== entity.sourceEntityId) continue;
      const key = storageKey(spec.entityType, spec.sourceEntityId);
      if (spec.once === true && consumedOnceKeys.has(key)) continue;
      return spec;
    }
    return undefined;
  }

  const persister: Persister = {
    upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult> {
      const matched = matchThrowSpec(entity);
      if (matched !== undefined) {
        if (matched.once === true) {
          consumedOnceKeys.add(storageKey(matched.entityType, matched.sourceEntityId));
        }
        return Promise.reject(matched.error);
      }

      const key = storageKey(entity.entityType, entity.sourceEntityId);
      const incomingHash = hashPayload(entity.payload);
      const existing = store.get(key);

      if (existing === undefined) {
        const pluralscapeEntityId = deterministicId(entity.entityType, entity.sourceEntityId);
        store.set(key, {
          pluralscapeEntityId,
          payloadHash: incomingHash,
          payload: entity.payload,
        });
        return Promise.resolve({ action: "created", pluralscapeEntityId });
      }

      if (existing.payloadHash === incomingHash) {
        return Promise.resolve({
          action: "skipped",
          pluralscapeEntityId: existing.pluralscapeEntityId,
        });
      }

      store.set(key, {
        pluralscapeEntityId: existing.pluralscapeEntityId,
        payloadHash: incomingHash,
        payload: entity.payload,
      });
      return Promise.resolve({
        action: "updated",
        pluralscapeEntityId: existing.pluralscapeEntityId,
      });
    },
    recordError(error: ImportError): Promise<void> {
      errors.push(error);
      return Promise.resolve();
    },
    flush(): Promise<void> {
      flushCount += 1;
      return Promise.resolve();
    },
  };

  return {
    persister,
    snapshot(): InMemoryPersisterSnapshot {
      const entities: StoredEntity[] = [];
      for (const [key, value] of store.entries()) {
        const separatorIndex = key.indexOf(":");
        const entityType = key.slice(0, separatorIndex) as ImportEntityType;
        const sourceEntityId = key.slice(separatorIndex + 1);
        entities.push({
          entityType,
          sourceEntityId,
          pluralscapeEntityId: value.pluralscapeEntityId,
          payload: value.payload,
        });
      }
      return {
        size: entities.length,
        entities,
        errors: [...errors],
        flushCount,
        countByType: (entityType) => entities.filter((e) => e.entityType === entityType).length,
        hasType: (entityType) => entities.some((e) => e.entityType === entityType),
        find: (entityType, sourceEntityId) => {
          const internal = store.get(storageKey(entityType, sourceEntityId));
          if (internal === undefined) return undefined;
          return {
            entityType,
            sourceEntityId,
            pluralscapeEntityId: internal.pluralscapeEntityId,
            payload: internal.payload,
          };
        },
      };
    },
  };
}
