import { trpc } from "@pluralscape/api-client/trpc";
import { decryptMember } from "@pluralscape/data/transforms/member";

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
import type { Archived, GroupId, Member, MemberId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawMember = RouterOutput["member"]["get"];
type RawMemberPage = RouterOutput["member"]["list"];
type MemberPage = {
  readonly data: (Member | Archived<Member>)[];
  readonly nextCursor: string | null;
};

interface MemberListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly groupId?: string;
  readonly includeArchived?: boolean;
}

export function useMember(
  memberId: MemberId,
  opts?: SystemIdOverride,
): TRPCQuery<Member | Archived<Member>> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.member.get.useQuery(
    { systemId, memberId },
    {
      enabled: masterKey !== null,
      select: (raw: RawMember): Member | Archived<Member> => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptMember(raw, masterKey);
      },
    },
  );
}

export function useMembersList(opts?: MemberListOpts): TRPCInfiniteQuery<MemberPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.member.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      groupId: opts?.groupId as GroupId | undefined,
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
            data: page.data.map((item) => decryptMember(item, key)),
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
