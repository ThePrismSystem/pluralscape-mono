import { trpc } from "@pluralscape/api-client/trpc";

import { type TRPCMutation } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

export function useInitiateDeviceTransfer(): TRPCMutation<
  RouterOutput["account"]["initiateDeviceTransfer"],
  RouterInput["account"]["initiateDeviceTransfer"]
> {
  return trpc.account.initiateDeviceTransfer.useMutation();
}

export function useApproveDeviceTransfer(): TRPCMutation<
  RouterOutput["account"]["approveDeviceTransfer"],
  RouterInput["account"]["approveDeviceTransfer"]
> {
  return trpc.account.approveDeviceTransfer.useMutation();
}

export function useCompleteDeviceTransfer(): TRPCMutation<
  RouterOutput["account"]["completeDeviceTransfer"],
  RouterInput["account"]["completeDeviceTransfer"]
> {
  return trpc.account.completeDeviceTransfer.useMutation();
}
