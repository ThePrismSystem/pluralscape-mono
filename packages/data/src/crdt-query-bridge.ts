// TODO: SyncEngine in @pluralscape/sync needs to add a getDocumentSnapshot() method
// to implement DocumentSnapshotProvider before this bridge can be wired to a real engine.

import type { SyncDocumentId } from "@pluralscape/types";
import type { QueryKey } from "@tanstack/react-query";

export interface DocumentSnapshotProvider {
  getDocumentSnapshot(documentId: SyncDocumentId): unknown;
}

export interface CrdtDocumentQueryOpts<TData> {
  readonly queryKey: QueryKey;
  readonly documentId: SyncDocumentId;
  readonly project: (doc: unknown) => TData;
}

export interface CrdtQueryBridge {
  documentQueryOptions<TData>(opts: CrdtDocumentQueryOpts<TData>): {
    readonly queryKey: QueryKey;
    readonly queryFn: () => TData;
  };
}

export function createCrdtQueryBridge(deps: { engine: DocumentSnapshotProvider }): CrdtQueryBridge {
  return {
    documentQueryOptions<TData>(opts: CrdtDocumentQueryOpts<TData>) {
      return {
        queryKey: opts.queryKey,
        queryFn: (): TData => {
          const doc = deps.engine.getDocumentSnapshot(opts.documentId);
          if (!doc) throw new Error(`Document ${opts.documentId} not loaded in sync engine`);
          return opts.project(doc);
        },
      };
    },
  };
}
