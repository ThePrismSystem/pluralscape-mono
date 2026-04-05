import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptFieldDefinition,
  decryptFieldValueList,
} from "@pluralscape/data/transforms/custom-field";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToFieldDefinition, rowToFieldValue } from "../data/row-transforms.js";
import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  FieldDefinitionDecrypted,
  FieldDefinitionPage,
  FieldDefinitionRaw,
  FieldValueDecrypted,
  FieldValueRaw,
} from "@pluralscape/data/transforms/custom-field";
import type { FieldDefinitionId, MemberId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type FieldDefPage = {
  readonly data: FieldDefinitionDecrypted[];
  readonly nextCursor: string | null;
};

interface FieldDefinitionListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useFieldDefinition(
  fieldDefinitionId: FieldDefinitionId,
  opts?: SystemIdOverride,
): DataQuery<FieldDefinitionDecrypted> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectFieldDefinition = useCallback(
    (raw: FieldDefinitionRaw): FieldDefinitionDecrypted => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptFieldDefinition(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["field_definitions", fieldDefinitionId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM field_definitions WHERE id = ?", [
        fieldDefinitionId,
      ]);
      if (!row) throw new Error("Field definition not found");
      return rowToFieldDefinition(row);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.field.definition.get.useQuery(
    { systemId, fieldDefinitionId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectFieldDefinition,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useFieldDefinitionsList(
  opts?: FieldDefinitionListOpts,
): DataListQuery<FieldDefinitionDecrypted> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectFieldDefinitionsList = useCallback(
    (data: InfiniteData<FieldDefinitionPage>): InfiniteData<FieldDefPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          data: page.data.map((item) => decryptFieldDefinition(item, key)),
          nextCursor: page.nextCursor,
        })),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["field_definitions", "list", systemId, opts?.includeArchived ?? false],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM field_definitions WHERE system_id = ?"
        : "SELECT * FROM field_definitions WHERE system_id = ? AND archived = 0";
      return localDb.queryAll(sql, [systemId]).map(rowToFieldDefinition);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.field.definition.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: FieldDefinitionPage) => lastPage.nextCursor,
      select: selectFieldDefinitionsList,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCreateField(): TRPCMutation<
  RouterOutput["field"]["definition"]["create"],
  RouterInput["field"]["definition"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.field.definition.create.useMutation({
    onSuccess: () => {
      void utils.field.definition.list.invalidate({ systemId });
    },
  });
}

export function useUpdateField(): TRPCMutation<
  RouterOutput["field"]["definition"]["update"],
  RouterInput["field"]["definition"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.field.definition.update.useMutation({
    onSuccess: (_data, variables) => {
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
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.field.definition.delete.useMutation({
    onSuccess: (_data, variables) => {
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
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectFieldValues = useCallback(
    (raw: readonly FieldValueRaw[]): FieldValueDecrypted[] => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptFieldValueList(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["field_values", "member", memberId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      return localDb
        .queryAll("SELECT * FROM field_values WHERE member_id = ?", [memberId])
        .map((row) => rowToFieldValue(row, systemId));
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.field.value.list.useQuery(
    { systemId, owner: { kind: "member", id: memberId } },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectFieldValues,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useUpdateMemberFieldValues(): TRPCMutation<
  RouterOutput["field"]["value"]["set"],
  RouterInput["field"]["value"]["set"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.field.value.set.useMutation({
    onSuccess: (_data, variables) => {
      void utils.field.value.list.invalidate({ systemId, owner: variables.owner });
    },
  });
}
