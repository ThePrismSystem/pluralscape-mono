import { trpc } from "@pluralscape/api-client/trpc";
import { decryptSnapshot, decryptSnapshotPage } from "@pluralscape/data/transforms/snapshot";
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
  SnapshotDecrypted,
  SnapshotPage as SnapshotRawPage,
  SnapshotRaw,
} from "@pluralscape/data/transforms/snapshot";
import type { SystemSnapshotId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type SnapshotPage = {
  readonly data: SnapshotDecrypted[];
  readonly nextCursor: string | null;
};

interface SnapshotListOpts extends SystemIdOverride {
  readonly limit?: number;
}

export function useSnapshot(
  snapshotId: SystemSnapshotId,
  opts?: SystemIdOverride,
): TRPCQuery<SnapshotDecrypted> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectSnapshot = useCallback(
    (raw: SnapshotRaw): SnapshotDecrypted => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptSnapshot(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.snapshot.get.useQuery(
    { systemId, snapshotId },
    {
      enabled: masterKey !== null,
      select: selectSnapshot,
    },
  );
}

export function useSnapshotsList(opts?: SnapshotListOpts): TRPCInfiniteQuery<SnapshotPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectPage = useCallback(
    (data: InfiniteData<SnapshotRawPage>): InfiniteData<SnapshotPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptSnapshotPage(page, key)),
      };
    },
    [masterKey],
  );

  return trpc.snapshot.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: SnapshotRawPage) => lastPage.nextCursor,
      select: selectPage,
    },
  );
}

export function useCreateSnapshot(): TRPCMutation<
  RouterOutput["snapshot"]["create"],
  RouterInput["snapshot"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.snapshot.create.useMutation({
    onSuccess: () => {
      void utils.snapshot.list.invalidate({ systemId });
    },
  });
}

export function useDeleteSnapshot(): TRPCMutation<
  RouterOutput["snapshot"]["delete"],
  RouterInput["snapshot"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.snapshot.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.snapshot.get.invalidate({ systemId, snapshotId: variables.snapshotId });
      void utils.snapshot.list.invalidate({ systemId });
    },
  });
}
