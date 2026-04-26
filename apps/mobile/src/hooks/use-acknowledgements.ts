import { trpc } from "@pluralscape/api-client/trpc";
import { decryptAcknowledgement } from "@pluralscape/data/transforms/acknowledgement";

import { rowToAcknowledgement } from "../data/row-transforms/index.js";

import {
  useOfflineFirstQuery,
  useOfflineFirstInfiniteQuery,
  useDomainMutation,
} from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { AcknowledgementPage as AcknowledgementWirePage } from "@pluralscape/data/transforms/acknowledgement";
import type {
  AcknowledgementId,
  AcknowledgementRequest,
  AcknowledgementRequestWire,
  Archived,
} from "@pluralscape/types";

interface AcknowledgementListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly confirmed?: boolean;
}

export function useAcknowledgement(
  ackId: AcknowledgementId,
  opts?: SystemIdOverride,
): DataQuery<AcknowledgementRequest | Archived<AcknowledgementRequest>> {
  return useOfflineFirstQuery<
    AcknowledgementRequestWire,
    AcknowledgementRequest | Archived<AcknowledgementRequest>
  >({
    queryKey: ["acknowledgements", ackId],
    table: "own_acknowledgements",
    entityId: ackId,
    rowTransform: rowToAcknowledgement,
    decrypt: decryptAcknowledgement,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.acknowledgement.get.useQuery({ systemId, ackId }, { enabled, select }) as DataQuery<
        AcknowledgementRequest | Archived<AcknowledgementRequest>
      >,
  });
}

export function useAcknowledgementsList(
  opts?: AcknowledgementListOpts,
): DataListQuery<AcknowledgementRequest | Archived<AcknowledgementRequest>> {
  return useOfflineFirstInfiniteQuery<
    AcknowledgementRequestWire,
    AcknowledgementRequest | Archived<AcknowledgementRequest>
  >({
    queryKey: ["acknowledgements", "list", opts?.includeArchived ?? false, opts?.confirmed],
    table: "own_acknowledgements",
    rowTransform: rowToAcknowledgement,
    decrypt: decryptAcknowledgement,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.acknowledgement.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
          confirmed: opts?.confirmed,
        },
        {
          enabled,
          getNextPageParam: (lastPage: AcknowledgementWirePage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<AcknowledgementRequest | Archived<AcknowledgementRequest>>,
  });
}

export function useCreateAcknowledgement(): TRPCMutation<
  RouterOutput["acknowledgement"]["create"],
  RouterInput["acknowledgement"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.acknowledgement.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.acknowledgement.list.invalidate({ systemId });
    },
  });
}

export function useConfirmAcknowledgement(): TRPCMutation<
  RouterOutput["acknowledgement"]["confirm"],
  RouterInput["acknowledgement"]["confirm"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.acknowledgement.confirm.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.acknowledgement.get.invalidate({ systemId, ackId: variables.ackId });
      void utils.acknowledgement.list.invalidate({ systemId });
    },
  });
}

export function useArchiveAcknowledgement(): TRPCMutation<
  RouterOutput["acknowledgement"]["archive"],
  RouterInput["acknowledgement"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.acknowledgement.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.acknowledgement.get.invalidate({ systemId, ackId: variables.ackId });
      void utils.acknowledgement.list.invalidate({ systemId });
    },
  });
}

export function useRestoreAcknowledgement(): TRPCMutation<
  RouterOutput["acknowledgement"]["restore"],
  RouterInput["acknowledgement"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.acknowledgement.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.acknowledgement.get.invalidate({ systemId, ackId: variables.ackId });
      void utils.acknowledgement.list.invalidate({ systemId });
    },
  });
}

export function useDeleteAcknowledgement(): TRPCMutation<
  RouterOutput["acknowledgement"]["delete"],
  RouterInput["acknowledgement"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.acknowledgement.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.acknowledgement.get.invalidate({ systemId, ackId: variables.ackId });
      void utils.acknowledgement.list.invalidate({ systemId });
    },
  });
}
