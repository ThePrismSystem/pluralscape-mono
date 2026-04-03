import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptAcknowledgement,
  decryptAcknowledgementPage,
} from "@pluralscape/data/transforms/acknowledgement";

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
import type { AcknowledgementDecrypted } from "@pluralscape/data/transforms/acknowledgement";
import type { AcknowledgementId, Archived } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawAcknowledgement = RouterOutput["acknowledgement"]["get"];
type RawAcknowledgementPage = RouterOutput["acknowledgement"]["list"];
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
): TRPCQuery<AcknowledgementDecrypted | Archived<AcknowledgementDecrypted>> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.acknowledgement.get.useQuery(
    { systemId, ackId },
    {
      enabled: masterKey !== null,
      select: (
        raw: RawAcknowledgement,
      ): AcknowledgementDecrypted | Archived<AcknowledgementDecrypted> => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptAcknowledgement(raw, masterKey);
      },
    },
  );
}

export function useAcknowledgementsList(
  opts?: AcknowledgementListOpts,
): TRPCInfiniteQuery<AcknowledgementPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.acknowledgement.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      confirmed: opts?.confirmed,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawAcknowledgementPage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawAcknowledgementPage>): InfiniteData<AcknowledgementPage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          ...data,
          pages: data.pages.map((page) => decryptAcknowledgementPage(page, key)),
        };
      },
    },
  );
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
