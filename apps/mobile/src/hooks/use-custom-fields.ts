import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptFieldDefinition,
  decryptFieldValueList,
} from "@pluralscape/data/transforms/custom-field";

import { rowToFieldDefinition, rowToFieldValue } from "../data/row-transforms/index.js";

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
import type {
  FieldDefinitionDecrypted,
  FieldDefinitionPage,
  FieldDefinitionRaw,
  FieldValueDecrypted,
  FieldValueRaw,
} from "@pluralscape/data/transforms/custom-field";
import type { FieldDefinitionId, MemberId } from "@pluralscape/types";

interface FieldDefinitionListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useFieldDefinition(
  fieldDefinitionId: FieldDefinitionId,
  opts?: SystemIdOverride,
): DataQuery<FieldDefinitionDecrypted> {
  return useOfflineFirstQuery<FieldDefinitionRaw, FieldDefinitionDecrypted>({
    queryKey: ["field_definitions", fieldDefinitionId],
    table: "field_definitions",
    entityId: fieldDefinitionId,
    rowTransform: rowToFieldDefinition,
    decrypt: decryptFieldDefinition,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.field.definition.get.useQuery(
        { systemId, fieldDefinitionId },
        { enabled, select },
      ) as DataQuery<FieldDefinitionDecrypted>,
  });
}

export function useFieldDefinitionsList(
  opts?: FieldDefinitionListOpts,
): DataListQuery<FieldDefinitionDecrypted> {
  return useOfflineFirstInfiniteQuery<FieldDefinitionRaw, FieldDefinitionDecrypted>({
    queryKey: ["field_definitions", "list", opts?.includeArchived ?? false],
    table: "field_definitions",
    rowTransform: rowToFieldDefinition,
    decrypt: decryptFieldDefinition,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.field.definition.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: FieldDefinitionPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<FieldDefinitionDecrypted>,
  });
}

export function useCreateField(): TRPCMutation<
  RouterOutput["field"]["definition"]["create"],
  RouterInput["field"]["definition"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.field.definition.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.field.definition.list.invalidate({ systemId });
    },
  });
}

export function useUpdateField(): TRPCMutation<
  RouterOutput["field"]["definition"]["update"],
  RouterInput["field"]["definition"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.field.definition.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.field.definition.get.invalidate({
        systemId,
        fieldDefinitionId: variables.fieldDefinitionId,
      });
      void utils.field.definition.list.invalidate({ systemId });
    },
  });
}

export function useArchiveFieldDefinition(): TRPCMutation<
  RouterOutput["field"]["definition"]["archive"],
  RouterInput["field"]["definition"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.field.definition.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.field.definition.get.invalidate({
        systemId,
        fieldDefinitionId: variables.fieldDefinitionId,
      });
      void utils.field.definition.list.invalidate({ systemId });
    },
  });
}

export function useRestoreFieldDefinition(): TRPCMutation<
  RouterOutput["field"]["definition"]["restore"],
  RouterInput["field"]["definition"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.field.definition.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.field.definition.get.invalidate({
        systemId,
        fieldDefinitionId: variables.fieldDefinitionId,
      });
      void utils.field.definition.list.invalidate({ systemId });
    },
  });
}

export function useDeleteField(): TRPCMutation<
  RouterOutput["field"]["definition"]["delete"],
  RouterInput["field"]["definition"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.field.definition.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.field.definition.get.invalidate({
        systemId,
        fieldDefinitionId: variables.fieldDefinitionId,
      });
      void utils.field.definition.list.invalidate({ systemId });
    },
  });
}

export function useMemberFieldValues(
  memberId: MemberId,
  opts?: SystemIdOverride,
): DataQuery<ReadonlyArray<FieldValueDecrypted>> {
  return useOfflineFirstQuery<readonly FieldValueRaw[], ReadonlyArray<FieldValueDecrypted>>({
    queryKey: ["field_values", "member", memberId],
    table: "field_values",
    entityId: memberId,
    rowTransform: () => {
      throw new Error("rowTransform unused — localQueryFn overrides");
    },
    decrypt: decryptFieldValueList,
    localQueryFn: (localDb, systemId) =>
      localDb
        .queryAll("SELECT * FROM field_values WHERE member_id = ? ORDER BY created_at DESC", [
          memberId,
        ])
        .map((row) => rowToFieldValue(row, systemId)),
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.field.value.list.useQuery(
        { systemId, owner: { kind: "member", id: memberId } },
        { enabled, select },
      ) as DataQuery<ReadonlyArray<FieldValueDecrypted>>,
  });
}

export function useUpdateMemberFieldValues(): TRPCMutation<
  RouterOutput["field"]["value"]["set"],
  RouterInput["field"]["value"]["set"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.field.value.set.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.field.value.list.invalidate({ systemId, owner: variables.owner });
    },
  });
}
