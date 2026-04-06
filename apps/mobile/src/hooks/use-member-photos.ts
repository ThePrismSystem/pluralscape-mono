import { trpc } from "@pluralscape/api-client/trpc";

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
import type { MemberId, MemberPhotoId } from "@pluralscape/types";

// ---------------------------------------------------------------------------
// Shared types — use RouterOutput to match what the API actually returns
// ---------------------------------------------------------------------------

type MemberPhotoGetResult = RouterOutput["memberPhoto"]["get"];
type MemberPhotoListItem = RouterOutput["memberPhoto"]["list"]["data"][number];

interface MemberPhotoGetOpts extends SystemIdOverride {
  readonly memberId: MemberId;
}

interface MemberPhotoListOpts extends SystemIdOverride {
  readonly memberId: MemberId;
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// Row transforms — remote-only stubs (no local transform file exists)
// ---------------------------------------------------------------------------

function rowToMemberPhotoNever(): never {
  throw new Error("rowToMemberPhoto: member photos are remote-only");
}

// ---------------------------------------------------------------------------
// Member photo queries
// ---------------------------------------------------------------------------

export function useMemberPhoto(
  photoId: MemberPhotoId,
  opts: MemberPhotoGetOpts,
): DataQuery<MemberPhotoGetResult> {
  return useOfflineFirstQuery<MemberPhotoGetResult, MemberPhotoGetResult>({
    queryKey: ["member-photos", opts.memberId, photoId],
    table: "member_photos",
    entityId: photoId,
    rowTransform: rowToMemberPhotoNever,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled }) =>
      trpc.memberPhoto.get.useQuery(
        { systemId, memberId: opts.memberId, photoId },
        { enabled },
      ) as DataQuery<MemberPhotoGetResult>,
  });
}

export function useMemberPhotosList(opts: MemberPhotoListOpts): DataListQuery<MemberPhotoListItem> {
  return useOfflineFirstInfiniteQuery<MemberPhotoListItem, MemberPhotoListItem>({
    queryKey: ["member-photos", "list", opts.memberId, opts.systemId],
    table: "member_photos",
    rowTransform: rowToMemberPhotoNever,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled }) =>
      trpc.memberPhoto.list.useInfiniteQuery(
        {
          systemId,
          memberId: opts.memberId,
          limit: opts.limit ?? DEFAULT_LIST_LIMIT,
        },
        {
          enabled,
          getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
      ) as DataListQuery<MemberPhotoListItem>,
  });
}

// ---------------------------------------------------------------------------
// Member photo mutations
// ---------------------------------------------------------------------------

export function useCreateMemberPhoto(): TRPCMutation<
  RouterOutput["memberPhoto"]["create"],
  RouterInput["memberPhoto"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.memberPhoto.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.memberPhoto.list.invalidate({ systemId, memberId: variables.memberId });
    },
  });
}

export function useArchiveMemberPhoto(): TRPCMutation<
  RouterOutput["memberPhoto"]["archive"],
  RouterInput["memberPhoto"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.memberPhoto.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.memberPhoto.get.invalidate({
        systemId,
        memberId: variables.memberId,
        photoId: variables.photoId,
      });
      void utils.memberPhoto.list.invalidate({ systemId, memberId: variables.memberId });
    },
  });
}

export function useRestoreMemberPhoto(): TRPCMutation<
  RouterOutput["memberPhoto"]["restore"],
  RouterInput["memberPhoto"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.memberPhoto.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.memberPhoto.get.invalidate({
        systemId,
        memberId: variables.memberId,
        photoId: variables.photoId,
      });
      void utils.memberPhoto.list.invalidate({ systemId, memberId: variables.memberId });
    },
  });
}

export function useDeleteMemberPhoto(): TRPCMutation<
  RouterOutput["memberPhoto"]["delete"],
  RouterInput["memberPhoto"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.memberPhoto.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.memberPhoto.get.invalidate({
        systemId,
        memberId: variables.memberId,
        photoId: variables.photoId,
      });
      void utils.memberPhoto.list.invalidate({ systemId, memberId: variables.memberId });
    },
  });
}

export function useReorderMemberPhotos(): TRPCMutation<
  RouterOutput["memberPhoto"]["reorder"],
  RouterInput["memberPhoto"]["reorder"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.memberPhoto.reorder.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.memberPhoto.list.invalidate({ systemId, memberId: variables.memberId });
    },
  });
}
