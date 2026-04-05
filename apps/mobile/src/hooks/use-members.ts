import { trpc } from "@pluralscape/api-client/trpc";
import { decryptMember } from "@pluralscape/data/transforms/member";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToMember } from "../data/row-transforms.js";
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
import type { MemberPage as MemberRawPage, MemberRaw } from "@pluralscape/data/transforms/member";
import type { Archived, GroupId, Member, MemberId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

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
): DataQuery<Member | Archived<Member>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectMember = useCallback(
    (raw: MemberRaw): Member | Archived<Member> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptMember(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["members", memberId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM members WHERE id = ?", [memberId]);
      if (!row) throw new Error("Member not found");
      return rowToMember(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.member.get.useQuery(
    { systemId, memberId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectMember,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useMembersList(opts?: MemberListOpts): DataListQuery<Member | Archived<Member>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectMembersList = useCallback(
    (data: InfiniteData<MemberRawPage>): InfiniteData<MemberPage> => {
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
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["members", "list", systemId, opts?.includeArchived ?? false],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM members WHERE system_id = ? ORDER BY created_at DESC"
        : "SELECT * FROM members WHERE system_id = ? AND archived = 0 ORDER BY created_at DESC";
      return localDb.queryAll(sql, [systemId]).map(rowToMember);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.member.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      groupId: opts?.groupId as GroupId | undefined,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: MemberRawPage) => lastPage.nextCursor,
      select: selectMembersList,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
