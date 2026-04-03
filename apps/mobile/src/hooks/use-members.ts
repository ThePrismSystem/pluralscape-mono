import { trpc } from "@pluralscape/api-client/trpc";
import { decryptMember } from "@pluralscape/data/transforms/member";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import type { AppRouter, RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { Member, MemberId, SystemId } from "@pluralscape/types";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { TRPCHookResult } from "@trpc/react-query/shared";

/** Default page size for member list queries. */
const DEFAULT_LIST_LIMIT = 20;

type RawMember = RouterOutput["member"]["get"];
type RawMemberPage = RouterOutput["member"]["list"];
type TRPCError = TRPCClientErrorLike<AppRouter>;
type MemberPage = { readonly items: Member[]; readonly nextCursor: string | null };
type TRPCQuery<T> = TRPCHookResult & UseQueryResult<T, TRPCError>;
type TRPCInfiniteQuery<T> = TRPCHookResult & UseInfiniteQueryResult<InfiniteData<T>, TRPCError>;
type TRPCMutation<TData, TVars> = TRPCHookResult & UseMutationResult<TData, TRPCError, TVars>;

interface SystemIdOverride {
  readonly systemId?: SystemId;
}

interface MemberListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly groupId?: string;
  readonly includeArchived?: boolean;
}

export function useMember(memberId: MemberId, opts?: SystemIdOverride): TRPCQuery<Member> {
  const systemId = opts?.systemId ?? useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.member.get.useQuery(
    { systemId, memberId },
    {
      enabled: masterKey !== null,
      select: (raw: RawMember): Member => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptMember(raw, masterKey);
      },
    },
  );
}

export function useMembersList(opts?: MemberListOpts): TRPCInfiniteQuery<MemberPage> {
  const systemId = opts?.systemId ?? useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.member.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      groupId: opts?.groupId as MemberId | undefined,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawMemberPage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawMemberPage>): InfiniteData<MemberPage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            items: page.data.map((item) => decryptMember(item, key)),
            nextCursor: page.nextCursor,
          })),
        };
      },
    },
  );
}

export function useCreateMember(): TRPCMutation<
  RouterOutput["member"]["create"],
  RouterInput["member"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.member.create.useMutation({
    onSuccess: () => {
      void utils.member.list.invalidate({ systemId });
    },
  });
}

export function useUpdateMember(): TRPCMutation<
  RouterOutput["member"]["update"],
  RouterInput["member"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.member.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.member.get.invalidate({ systemId, memberId: variables.memberId });
      void utils.member.list.invalidate({ systemId });
    },
  });
}

export function useArchiveMember(): TRPCMutation<
  RouterOutput["member"]["archive"],
  RouterInput["member"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.member.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.member.get.invalidate({ systemId, memberId: variables.memberId });
      void utils.member.list.invalidate({ systemId });
    },
  });
}

export function useRestoreMember(): TRPCMutation<
  RouterOutput["member"]["restore"],
  RouterInput["member"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.member.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.member.get.invalidate({ systemId, memberId: variables.memberId });
      void utils.member.list.invalidate({ systemId });
    },
  });
}

export function useDuplicateMember(): TRPCMutation<
  RouterOutput["member"]["duplicate"],
  RouterInput["member"]["duplicate"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.member.duplicate.useMutation({
    onSuccess: () => {
      void utils.member.list.invalidate({ systemId });
    },
  });
}
