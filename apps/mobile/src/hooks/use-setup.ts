import { trpc } from "@pluralscape/api-client/trpc";

import { useDomainMutation } from "./factories.js";
import { type DataQuery, type TRPCMutation } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type SetupStatusResult = RouterOutput["systemSettings"]["setup"]["getStatus"];

// ---------------------------------------------------------------------------
// Setup status query — plain tRPC, no offline-first factory needed
// ---------------------------------------------------------------------------

export function useSetupStatus(systemId: string): DataQuery<SetupStatusResult> {
  return trpc.systemSettings.setup.getStatus.useQuery(
    { systemId },
    { enabled: !!systemId },
  ) as DataQuery<SetupStatusResult>;
}

// ---------------------------------------------------------------------------
// Setup step mutations — each invalidates settings + status on success
// ---------------------------------------------------------------------------

export function useSetupNomenclatureStep(): TRPCMutation<
  RouterOutput["systemSettings"]["setup"]["nomenclatureStep"],
  RouterInput["systemSettings"]["setup"]["nomenclatureStep"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.systemSettings.setup.nomenclatureStep.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.systemSettings.settings.get.invalidate({ systemId });
      void utils.systemSettings.setup.getStatus.invalidate({ systemId });
    },
  });
}

export function useSetupProfileStep(): TRPCMutation<
  RouterOutput["systemSettings"]["setup"]["profileStep"],
  RouterInput["systemSettings"]["setup"]["profileStep"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.systemSettings.setup.profileStep.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.systemSettings.settings.get.invalidate({ systemId });
      void utils.systemSettings.setup.getStatus.invalidate({ systemId });
    },
  });
}

export function useSetupComplete(): TRPCMutation<
  RouterOutput["systemSettings"]["setup"]["complete"],
  RouterInput["systemSettings"]["setup"]["complete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.systemSettings.setup.complete.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.systemSettings.settings.get.invalidate({ systemId });
      void utils.systemSettings.setup.getStatus.invalidate({ systemId });
    },
  });
}
