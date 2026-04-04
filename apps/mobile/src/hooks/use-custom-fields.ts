import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptFieldDefinition,
  decryptFieldValueList,
} from "@pluralscape/data/transforms/custom-field";
import { useCallback } from "react";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  FieldDefinitionDecrypted,
  FieldValueDecrypted,
} from "@pluralscape/data/transforms/custom-field";
import type { FieldDefinitionId, MemberId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawFieldDef = RouterOutput["field"]["definition"]["get"];
type RawFieldDefPage = RouterOutput["field"]["definition"]["list"];
type RawFieldValueList = RouterOutput["field"]["value"]["list"];
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
): TRPCQuery<FieldDefinitionDecrypted> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectFieldDefinition = useCallback(
    (raw: RawFieldDef): FieldDefinitionDecrypted => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptFieldDefinition(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.field.definition.get.useQuery(
    { systemId, fieldDefinitionId },
    {
      enabled: masterKey !== null,
      select: selectFieldDefinition,
    },
  );
}

export function useFieldDefinitionsList(
  opts?: FieldDefinitionListOpts,
): TRPCInfiniteQuery<FieldDefPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectFieldDefinitionsList = useCallback(
    (data: InfiniteData<RawFieldDefPage>): InfiniteData<FieldDefPage> => {
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

  return trpc.field.definition.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawFieldDefPage) => lastPage.nextCursor,
      select: selectFieldDefinitionsList,
    },
  );
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
): TRPCQuery<FieldValueDecrypted[]> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectFieldValues = useCallback(
    (raw: RawFieldValueList): FieldValueDecrypted[] => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptFieldValueList(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.field.value.list.useQuery(
    { systemId, owner: { kind: "member", id: memberId } },
    {
      enabled: masterKey !== null,
      select: selectFieldValues,
    },
  );
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
