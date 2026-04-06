import { trpc } from "@pluralscape/api-client/trpc";
import { decryptGroup } from "@pluralscape/data/transforms/group";

import { rowToGroup } from "../data/row-transforms/index.js";

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
  GroupDecrypted,
  GroupPage as GroupRawPage,
  GroupRaw,
} from "@pluralscape/data/transforms/group";
import type { GroupId, MemberId } from "@pluralscape/types";

interface GroupListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useGroup(groupId: GroupId, opts?: SystemIdOverride): DataQuery<GroupDecrypted> {
  return useOfflineFirstQuery<GroupRaw, GroupDecrypted>({
    queryKey: ["groups", groupId],
    table: "groups",
    entityId: groupId,
    rowTransform: rowToGroup,
    decrypt: decryptGroup,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.group.get.useQuery(
        { systemId, groupId },
        { enabled, select },
      ) as DataQuery<GroupDecrypted>,
  });
}

export function useGroupsList(opts?: GroupListOpts): DataListQuery<GroupDecrypted> {
  return useOfflineFirstInfiniteQuery<GroupRaw, GroupDecrypted>({
    queryKey: ["groups", "list", opts?.includeArchived ?? false],
    table: "groups",
    rowTransform: rowToGroup,
    decrypt: decryptGroup,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.group.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: GroupRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<GroupDecrypted>,
  });
}

export function useCreateGroup(): TRPCMutation<
  RouterOutput["group"]["create"],
  RouterInput["group"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.group.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.group.list.invalidate({ systemId });
    },
  });
}

export function useUpdateGroup(): TRPCMutation<
  RouterOutput["group"]["update"],
  RouterInput["group"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.group.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.group.get.invalidate({ systemId, groupId: variables.groupId });
      void utils.group.list.invalidate({ systemId });
    },
  });
}

export function useArchiveGroup(): TRPCMutation<
  RouterOutput["group"]["archive"],
  RouterInput["group"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.group.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.group.get.invalidate({ systemId, groupId: variables.groupId });
      void utils.group.list.invalidate({ systemId });
    },
  });
}

export function useRestoreGroup(): TRPCMutation<
  RouterOutput["group"]["restore"],
  RouterInput["group"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.group.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.group.get.invalidate({ systemId, groupId: variables.groupId });
      void utils.group.list.invalidate({ systemId });
    },
  });
}

export function useDeleteGroup(): TRPCMutation<
  RouterOutput["group"]["delete"],
  RouterInput["group"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.group.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.group.get.invalidate({ systemId, groupId: variables.groupId });
      void utils.group.list.invalidate({ systemId });
    },
  });
}

export function useAddGroupMembers(): TRPCMutation<
  RouterOutput["group"]["addMember"],
  RouterInput["group"]["addMember"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.group.addMember.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.group.removeMember.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.group.reorder.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.group.list.invalidate({ systemId });
    },
  });
}

export function useMoveGroup(): TRPCMutation<
  RouterOutput["group"]["move"],
  RouterInput["group"]["move"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.group.move.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.group.get.invalidate({ systemId, groupId: variables.groupId });
      void utils.group.list.invalidate({ systemId });
    },
  });
}

export function useCopyGroup(): TRPCMutation<
  RouterOutput["group"]["copy"],
  RouterInput["group"]["copy"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.group.copy.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.group.list.invalidate({ systemId });
      void utils.member.list.invalidate({ systemId });
    },
  });
}
