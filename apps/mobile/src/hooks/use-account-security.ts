import { trpc } from "@pluralscape/api-client/trpc";

import { type TRPCMutation, type TRPCQuery } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

export function useSetPin(): TRPCMutation<
  RouterOutput["account"]["setPin"],
  RouterInput["account"]["setPin"]
> {
  return trpc.account.setPin.useMutation();
}

export function useRemovePin(): TRPCMutation<
  RouterOutput["account"]["removePin"],
  RouterInput["account"]["removePin"]
> {
  return trpc.account.removePin.useMutation();
}

export function useVerifyPin(): TRPCMutation<
  RouterOutput["account"]["verifyPin"],
  RouterInput["account"]["verifyPin"]
> {
  return trpc.account.verifyPin.useMutation();
}

export function useEnrollBiometric(): TRPCMutation<
  RouterOutput["account"]["enrollBiometric"],
  RouterInput["account"]["enrollBiometric"]
> {
  return trpc.account.enrollBiometric.useMutation();
}

export function useVerifyBiometric(): TRPCMutation<
  RouterOutput["account"]["verifyBiometric"],
  RouterInput["account"]["verifyBiometric"]
> {
  return trpc.account.verifyBiometric.useMutation();
}

export function useRecoveryKeyStatus(): TRPCQuery<RouterOutput["account"]["getRecoveryKeyStatus"]> {
  return trpc.account.getRecoveryKeyStatus.useQuery();
}

export function useRegenerateRecoveryKey(): TRPCMutation<
  RouterOutput["account"]["regenerateRecoveryKey"],
  RouterInput["account"]["regenerateRecoveryKey"]
> {
  const utils = trpc.useUtils();

  return trpc.account.regenerateRecoveryKey.useMutation({
    onSuccess: () => {
      void utils.account.getRecoveryKeyStatus.invalidate();
    },
  });
}
