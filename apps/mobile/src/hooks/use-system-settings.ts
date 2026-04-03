import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptNomenclature,
  decryptSystemSettings,
} from "@pluralscape/data/transforms/system-settings";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import { type TRPCMutation, type TRPCQuery } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { DecryptedNomenclature } from "@pluralscape/data/transforms/system-settings";
import type { SystemSettings } from "@pluralscape/types";

type RawSystemSettings = RouterOutput["systemSettings"]["settings"]["get"];
type RawNomenclature = RouterOutput["systemSettings"]["nomenclature"]["get"];

export function useSystemSettings(): TRPCQuery<SystemSettings> {
  const systemId = useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.systemSettings.settings.get.useQuery(
    { systemId },
    {
      enabled: masterKey !== null,
      select: (raw: RawSystemSettings): SystemSettings => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptSystemSettings(raw, masterKey);
      },
    },
  );
}

export function useNomenclature(): TRPCQuery<DecryptedNomenclature> {
  const systemId = useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.systemSettings.nomenclature.get.useQuery(
    { systemId },
    {
      enabled: masterKey !== null,
      select: (raw: RawNomenclature): DecryptedNomenclature => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptNomenclature(raw, masterKey);
      },
    },
  );
}

export function useUpdateSettings(): TRPCMutation<
  RouterOutput["systemSettings"]["settings"]["update"],
  RouterInput["systemSettings"]["settings"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.systemSettings.settings.update.useMutation({
    onSuccess: () => {
      void utils.systemSettings.settings.get.invalidate({ systemId });
    },
  });
}

export function useUpdateNomenclature(): TRPCMutation<
  RouterOutput["systemSettings"]["nomenclature"]["update"],
  RouterInput["systemSettings"]["nomenclature"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.systemSettings.nomenclature.update.useMutation({
    onSuccess: () => {
      void utils.systemSettings.nomenclature.get.invalidate({ systemId });
    },
  });
}

export function useSetPin(): TRPCMutation<
  RouterOutput["systemSettings"]["pin"]["set"],
  RouterInput["systemSettings"]["pin"]["set"]
> {
  return trpc.systemSettings.pin.set.useMutation();
}

export function useRemovePin(): TRPCMutation<
  RouterOutput["systemSettings"]["pin"]["remove"],
  RouterInput["systemSettings"]["pin"]["remove"]
> {
  return trpc.systemSettings.pin.remove.useMutation();
}

export function useVerifyPin(): TRPCMutation<
  RouterOutput["systemSettings"]["pin"]["verify"],
  RouterInput["systemSettings"]["pin"]["verify"]
> {
  return trpc.systemSettings.pin.verify.useMutation();
}
