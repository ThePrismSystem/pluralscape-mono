/**
 * Mobile hooks for the device-transfer protocol.
 *
 * UX contract (see `packages/crypto/src/device-transfer.ts` for the security model):
 *
 * The QR code scanned from the source device carries only `{ requestId, salt }`.
 * The 10-digit verification code is NOT embedded in the QR — the user must type it
 * manually on the target device. The calling screen is responsible for:
 *
 *   1. Scanning the QR and passing its decoded `salt` + `requestId` into the
 *      transfer-key derivation step.
 *   2. Prompting the user to enter the 10-digit code shown on the source device,
 *      and passing that code as a separate input to `deriveTransferKey(code, salt)`.
 *
 * Splitting the two factors (QR-delivered salt + manually entered code) closes the
 * MITM/photography window that would otherwise exist if the QR alone were sufficient
 * to derive the transfer key.
 */

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
