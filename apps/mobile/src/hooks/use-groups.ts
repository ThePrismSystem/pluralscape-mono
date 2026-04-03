import { trpc } from "@pluralscape/api-client/trpc";
import { decryptGroup } from "@pluralscape/data/transforms/group";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import type { AppRouter, RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { GroupDecrypted } from "@pluralscape/data/transforms/group";
import type { GroupId, MemberId, SystemId } from "@pluralscape/types";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { TRPCHookResult } from "@trpc/react-query/shared";

/** Default page size for group list queries. */
const DEFAULT_LIST_LIMIT = 20;

type RawGroup = RouterOutput["group"]["get"];
type RawGroupPage = RouterOutput["group"]["list"];
type TRPCError = TRPCClientErrorLike<AppRouter>;
type GroupPage = { readonly items: GroupDecrypted[]; readonly nextCursor: string | null };
type TRPCQuery<T> = TRPCHookResult & UseQueryResult<T, TRPCError>;
type TRPCInfiniteQuery<T> = TRPCHookResult & UseInfiniteQueryResult<InfiniteData<T>, TRPCError>;
type TRPCMutation<TData, TVars> = TRPCHookResult & UseMutationResult<TData, TRPCError, TVars>;

interface SystemIdOverride {
  readonly systemId?: SystemId;
}

interface GroupListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useGroup(groupId: GroupId, opts?: SystemIdOverride): TRPCQuery<GroupDecrypted> {
  const systemId = opts?.systemId ?? useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.group.get.useQuery(
    { systemId, groupId },
    {
      enabled: masterKey !== null,
      select: (raw: RawGroup): GroupDecrypted => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptGroup(raw, masterKey);
      },
    },
  );
}

export function useGroupsList(opts?: GroupListOpts): TRPCInfiniteQuery<GroupPage> {
  const systemId = opts?.systemId ?? useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.group.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawGroupPage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawGroupPage>): InfiniteData<GroupPage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            items: page.data.map((item) => decryptGroup(item, key)),
            nextCursor: page.nextCursor,
          })),
        };
      },
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
