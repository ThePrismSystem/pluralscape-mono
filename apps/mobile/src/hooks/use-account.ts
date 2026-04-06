import { trpc } from "@pluralscape/api-client/trpc";

import { useDomainMutation } from "./factories.js";
import { type TRPCMutation, type TRPCQuery } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type AccountInfo = RouterOutput["account"]["get"];

/** 5 minutes — account data changes infrequently. */
const ACCOUNT_STALE_TIME_MS = 5 * 60_000;

export function useAccount(): TRPCQuery<AccountInfo> {
  return trpc.account.get.useQuery(undefined, {
    staleTime: ACCOUNT_STALE_TIME_MS,
  });
}

export function useChangeEmail(): TRPCMutation<
  RouterOutput["account"]["changeEmail"],
  RouterInput["account"]["changeEmail"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.account.changeEmail.useMutation(mutOpts),
    onInvalidate: (utils) => {
      void utils.account.get.invalidate();
    },
  });
}

export function useChangePassword(): TRPCMutation<
  RouterOutput["account"]["changePassword"],
  RouterInput["account"]["changePassword"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.account.changePassword.useMutation(mutOpts),
    onInvalidate: (utils) => {
      void utils.account.get.invalidate();
    },
  });
}

export function useUpdateAccountSettings(): TRPCMutation<
  RouterOutput["account"]["updateSettings"],
  RouterInput["account"]["updateSettings"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.account.updateSettings.useMutation(mutOpts),
    onInvalidate: (utils) => {
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
