import { trpc } from "@pluralscape/api-client/trpc";
import { decryptGroup } from "@pluralscape/data/transforms/group";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToGroupRow } from "../data/row-transforms.js";
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

import type { GroupLocalRow } from "../data/row-transforms.js";
import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  GroupDecrypted,
  GroupPage as GroupRawPage,
  GroupRaw,
} from "@pluralscape/data/transforms/group";
import type { GroupId, MemberId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type GroupPage = { readonly data: GroupDecrypted[]; readonly nextCursor: string | null };

interface GroupListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useGroup(
  groupId: GroupId,
  opts?: SystemIdOverride,
): DataQuery<GroupDecrypted | GroupLocalRow> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectGroup = useCallback(
    (raw: GroupRaw): GroupDecrypted => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptGroup(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["groups", groupId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM groups WHERE id = ?", [groupId]);
      if (!row) throw new Error("Group not found");
      return rowToGroupRow(row);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.group.get.useQuery(
    { systemId, groupId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectGroup,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useGroupsList(opts?: GroupListOpts): DataListQuery<GroupDecrypted | GroupLocalRow> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectGroupsList = useCallback(
    (data: InfiniteData<GroupRawPage>): InfiniteData<GroupPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          data: page.data.map((item) => decryptGroup(item, key)),
          nextCursor: page.nextCursor,
        })),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["groups", "list", systemId, opts?.includeArchived ?? false],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM groups WHERE system_id = ?"
        : "SELECT * FROM groups WHERE system_id = ? AND archived = 0";
      return localDb.queryAll(sql, [systemId]).map(rowToGroupRow);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.group.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: GroupRawPage) => lastPage.nextCursor,
      select: selectGroupsList,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCreateGroup(): TRPCMutation<
  RouterOutput["group"]["create"],
  RouterInput["group"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.group.create.useMutation({
    onSuccess: () => {
      void utils.group.list.invalidate({ systemId });
    },
  });
}

export function useUpdateGroup(): TRPCMutation<
  RouterOutput["group"]["update"],
  RouterInput["group"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.group.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.group.get.invalidate({ systemId, groupId: variables.groupId });
      void utils.group.list.invalidate({ systemId });
    },
  });
}

export function useDeleteGroup(): TRPCMutation<
  RouterOutput["group"]["delete"],
  RouterInput["group"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.group.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.group.get.invalidate({ systemId, groupId: variables.groupId });
      void utils.group.list.invalidate({ systemId });
    },
  });
}

export function useAddGroupMembers(): TRPCMutation<
  RouterOutput["group"]["addMember"],
  RouterInput["group"]["addMember"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.group.addMember.useMutation({
    onSuccess: (_data, variables) => {
      void utils.group.listMembers.invalidate({ systemId, groupId: variables.groupId });
      void utils.member.listMemberships.invalidate({
        systemId,
        memberId: variables.memberId as MemberId,
      });
    },
  });
}

export function useRemoveGroupMembers(): TRPCMutation<
  RouterOutput["group"]["removeMember"],
  RouterInput["group"]["removeMember"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.group.removeMember.useMutation({
    onSuccess: (_data, variables) => {
      void utils.group.listMembers.invalidate({ systemId, groupId: variables.groupId as GroupId });
      void utils.member.listMemberships.invalidate({
        systemId,
        memberId: variables.memberId as MemberId,
      });
    },
  });
}

export function useReorderGroups(): TRPCMutation<
  RouterOutput["group"]["reorder"],
  RouterInput["group"]["reorder"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.group.reorder.useMutation({
    onSuccess: () => {
      void utils.group.list.invalidate({ systemId });
    },
  });
}
