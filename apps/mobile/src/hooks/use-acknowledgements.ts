import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptAcknowledgement,
  decryptAcknowledgementPage,
} from "@pluralscape/data/transforms/acknowledgement";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToAcknowledgement } from "../data/row-transforms.js";
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
import type {
  AcknowledgementDecrypted,
  AcknowledgementPage as AcknowledgementRawPage,
  AcknowledgementRaw,
} from "@pluralscape/data/transforms/acknowledgement";
import type { AcknowledgementId, Archived } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type AcknowledgementPage = {
  readonly data: (AcknowledgementDecrypted | Archived<AcknowledgementDecrypted>)[];
  readonly nextCursor: string | null;
};

interface AcknowledgementListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly confirmed?: boolean;
}

export function useAcknowledgement(
  ackId: AcknowledgementId,
  opts?: SystemIdOverride,
): DataQuery<AcknowledgementDecrypted | Archived<AcknowledgementDecrypted>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectAcknowledgement = useCallback(
    (raw: AcknowledgementRaw): AcknowledgementDecrypted | Archived<AcknowledgementDecrypted> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptAcknowledgement(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["acknowledgements", ackId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM own_acknowledgements WHERE id = ?", [ackId]);
      if (!row) throw new Error("Acknowledgement not found");
      return rowToAcknowledgement(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.acknowledgement.get.useQuery(
    { systemId, ackId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectAcknowledgement,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useAcknowledgementsList(
  opts?: AcknowledgementListOpts,
): DataListQuery<AcknowledgementDecrypted | Archived<AcknowledgementDecrypted>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectAcknowledgementPage = useCallback(
    (data: InfiniteData<AcknowledgementRawPage>): InfiniteData<AcknowledgementPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptAcknowledgementPage(page, key)),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: [
      "acknowledgements",
      "list",
      systemId,
      opts?.includeArchived ?? false,
      opts?.confirmed,
    ],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM own_acknowledgements WHERE system_id = ?"
        : "SELECT * FROM own_acknowledgements WHERE system_id = ? AND archived = 0";
      return localDb.queryAll(sql, [systemId]).map(rowToAcknowledgement);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.acknowledgement.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      confirmed: opts?.confirmed,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: AcknowledgementRawPage) => lastPage.nextCursor,
      select: selectAcknowledgementPage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCreateAcknowledgement(): TRPCMutation<
  RouterOutput["acknowledgement"]["create"],
  RouterInput["acknowledgement"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.acknowledgement.create.useMutation({
    onSuccess: () => {
      void utils.acknowledgement.list.invalidate({ systemId });
    },
  });
}

export function useConfirmAcknowledgement(): TRPCMutation<
  RouterOutput["acknowledgement"]["confirm"],
  RouterInput["acknowledgement"]["confirm"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.acknowledgement.confirm.useMutation({
    onSuccess: (_data, variables) => {
      void utils.acknowledgement.get.invalidate({ systemId, ackId: variables.ackId });
      void utils.acknowledgement.list.invalidate({ systemId });
    },
  });
}

export function useArchiveAcknowledgement(): TRPCMutation<
  RouterOutput["acknowledgement"]["archive"],
  RouterInput["acknowledgement"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.acknowledgement.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.acknowledgement.get.invalidate({ systemId, ackId: variables.ackId });
      void utils.acknowledgement.list.invalidate({ systemId });
    },
  });
}

export function useRestoreAcknowledgement(): TRPCMutation<
  RouterOutput["acknowledgement"]["restore"],
  RouterInput["acknowledgement"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.acknowledgement.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.acknowledgement.get.invalidate({ systemId, ackId: variables.ackId });
      void utils.acknowledgement.list.invalidate({ systemId });
    },
  });
}

export function useDeleteAcknowledgement(): TRPCMutation<
  RouterOutput["acknowledgement"]["delete"],
  RouterInput["acknowledgement"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.acknowledgement.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.acknowledgement.get.invalidate({ systemId, ackId: variables.ackId });
      void utils.acknowledgement.list.invalidate({ systemId });
    },
  });
}
