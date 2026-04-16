import { trpc } from "@pluralscape/api-client/trpc";
import { decryptMember } from "@pluralscape/data/transforms/member";
import { brandId } from "@pluralscape/types";

import { rowToMember } from "../data/row-transforms/index.js";

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
import type { MemberPage as MemberRawPage, MemberRaw } from "@pluralscape/data/transforms/member";
import type { Archived, GroupId, Member, MemberId } from "@pluralscape/types";

interface MemberListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly groupId?: string;
  readonly includeArchived?: boolean;
}

export function useMember(
  memberId: MemberId,
  opts?: SystemIdOverride,
): DataQuery<Member | Archived<Member>> {
  return useOfflineFirstQuery<MemberRaw, Member | Archived<Member>>({
    queryKey: ["members", memberId],
    table: "members",
    entityId: memberId,
    rowTransform: rowToMember,
    decrypt: decryptMember,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.member.get.useQuery({ systemId, memberId }, { enabled, select }) as DataQuery<
        Member | Archived<Member>
      >,
  });
}

export function useMembersList(opts?: MemberListOpts): DataListQuery<Member | Archived<Member>> {
  return useOfflineFirstInfiniteQuery<MemberRaw, Member | Archived<Member>>({
    queryKey: ["members", "list", opts?.includeArchived ?? false],
    table: "members",
    rowTransform: rowToMember,
    decrypt: decryptMember,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.member.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          groupId: opts?.groupId ? brandId<GroupId>(opts.groupId) : undefined,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: MemberRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<Member | Archived<Member>>,
  });
}

export function useCreateMember(): TRPCMutation<
  RouterOutput["member"]["create"],
  RouterInput["member"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.member.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.member.list.invalidate({ systemId });
    },
  });
}

export function useUpdateMember(): TRPCMutation<
  RouterOutput["member"]["update"],
  RouterInput["member"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.member.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.member.get.invalidate({ systemId, memberId: variables.memberId });
      void utils.member.list.invalidate({ systemId });
    },
  });
}

export function useArchiveMember(): TRPCMutation<
  RouterOutput["member"]["archive"],
  RouterInput["member"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.member.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.member.get.invalidate({ systemId, memberId: variables.memberId });
      void utils.member.list.invalidate({ systemId });
    },
  });
}

export function useRestoreMember(): TRPCMutation<
  RouterOutput["member"]["restore"],
  RouterInput["member"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.member.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.member.get.invalidate({ systemId, memberId: variables.memberId });
      void utils.member.list.invalidate({ systemId });
    },
  });
}

export function useDeleteMember(): TRPCMutation<
  RouterOutput["member"]["delete"],
  RouterInput["member"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.member.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.member.get.invalidate({ systemId, memberId: variables.memberId });
      void utils.member.list.invalidate({ systemId });
    },
  });
}

export function useDuplicateMember(): TRPCMutation<
  RouterOutput["member"]["duplicate"],
  RouterInput["member"]["duplicate"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.member.duplicate.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.member.list.invalidate({ systemId });
    },
  });
}
