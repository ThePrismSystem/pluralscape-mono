import { trpc } from "@pluralscape/api-client/trpc";

import { type TRPCMutation, type TRPCQuery } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type AccountInfo = RouterOutput["account"]["get"];

export function useAccount(): TRPCQuery<AccountInfo> {
  return trpc.account.get.useQuery();
}

export function useChangeEmail(): TRPCMutation<
  RouterOutput["account"]["changeEmail"],
  RouterInput["account"]["changeEmail"]
> {
  const utils = trpc.useUtils();

  return trpc.account.changeEmail.useMutation({
    onSuccess: () => {
      void utils.account.get.invalidate();
    },
  });
}

export function useChangePassword(): TRPCMutation<
  RouterOutput["account"]["changePassword"],
  RouterInput["account"]["changePassword"]
> {
  const utils = trpc.useUtils();

  return trpc.account.changePassword.useMutation({
    onSuccess: () => {
      void utils.account.get.invalidate();
    },
  });
}

export function useUpdateAccountSettings(): TRPCMutation<
  RouterOutput["account"]["updateSettings"],
  RouterInput["account"]["updateSettings"]
> {
  const utils = trpc.useUtils();

  return trpc.account.updateSettings.useMutation({
    onSuccess: () => {
      void utils.account.get.invalidate();
    },
  });
}

export function useDeleteAccount(): TRPCMutation<
  RouterOutput["account"]["deleteAccount"],
  RouterInput["account"]["deleteAccount"]
> {
  return trpc.account.deleteAccount.useMutation();
}
