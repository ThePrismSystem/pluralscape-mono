import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import { type SystemIdOverride, type TRPCMutation, type TRPCQuery } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

export function useCanvas(
  opts?: SystemIdOverride,
): TRPCQuery<RouterOutput["innerworld"]["canvas"]["get"]> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.innerworld.canvas.get.useQuery({ systemId });
}

export function useUpsertCanvas(): TRPCMutation<
  RouterOutput["innerworld"]["canvas"]["upsert"],
  RouterInput["innerworld"]["canvas"]["upsert"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.innerworld.canvas.upsert.useMutation({
    onSuccess: () => {
      void utils.innerworld.canvas.get.invalidate({ systemId });
    },
  });
}
