import { trpc } from "@pluralscape/api-client/trpc";
import { decryptCanvas } from "@pluralscape/data/transforms/innerworld-canvas";
import { useCallback } from "react";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import { useDomainMutation } from "./factories.js";
import { type SystemIdOverride, type TRPCMutation, type TRPCQuery } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { CanvasDecrypted, CanvasRaw } from "@pluralscape/data/transforms/innerworld-canvas";

export function useCanvas(opts?: SystemIdOverride): TRPCQuery<CanvasDecrypted> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectCanvas = useCallback(
    (raw: CanvasRaw): CanvasDecrypted => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptCanvas(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.innerworld.canvas.get.useQuery(
    { systemId },
    {
      enabled: masterKey !== null,
      select: selectCanvas,
    },
  );
}

export function useUpsertCanvas(): TRPCMutation<
  RouterOutput["innerworld"]["canvas"]["upsert"],
  RouterInput["innerworld"]["canvas"]["upsert"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.innerworld.canvas.upsert.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.innerworld.canvas.get.invalidate({ systemId });
    },
  });
}
