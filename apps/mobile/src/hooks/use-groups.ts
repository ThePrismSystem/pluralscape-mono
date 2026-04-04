import { trpc } from "@pluralscape/api-client/trpc";
import { decryptGroup } from "@pluralscape/data/transforms/group";
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
import type { GroupDecrypted } from "@pluralscape/data/transforms/group";
import type { GroupId, MemberId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawGroup = RouterOutput["group"]["get"];
type RawGroupPage = RouterOutput["group"]["list"];
type GroupPage = { readonly data: GroupDecrypted[]; readonly nextCursor: string | null };

interface GroupListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useGroup(groupId: GroupId, opts?: SystemIdOverride): TRPCQuery<GroupDecrypted> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectGroup = useCallback(
    (raw: RawGroup): GroupDecrypted => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptGroup(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.group.get.useQuery(
    { systemId, groupId },
    {
      enabled: masterKey !== null,
      select: selectGroup,
    },
  );
}

export function useGroupsList(opts?: GroupListOpts): TRPCInfiniteQuery<GroupPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectGroupsList = useCallback(
    (data: InfiniteData<RawGroupPage>): InfiniteData<GroupPage> => {
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

  return trpc.group.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawGroupPage) => lastPage.nextCursor,
      select: selectGroupsList,
    },
  );
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
