import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptNomenclature,
  decryptSystemSettings,
} from "@pluralscape/data/transforms/system-settings";
import { useCallback } from "react";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import { type TRPCMutation, type TRPCQuery } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  DecryptedNomenclature,
  NomenclatureSettingsRaw,
  SystemSettingsRaw,
} from "@pluralscape/data/transforms/system-settings";
import type { SystemSettings } from "@pluralscape/types";

export function useSystemSettings(): TRPCQuery<SystemSettings> {
  const systemId = useActiveSystemId();
  const masterKey = useMasterKey();

  const selectSystemSettings = useCallback(
    (raw: SystemSettingsRaw): SystemSettings => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptSystemSettings(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.systemSettings.settings.get.useQuery(
    { systemId },
    {
      enabled: masterKey !== null,
      select: selectSystemSettings,
    },
  );
}

export function useNomenclature(): TRPCQuery<DecryptedNomenclature> {
  const systemId = useActiveSystemId();
  const masterKey = useMasterKey();

  const selectNomenclature = useCallback(
    (raw: NomenclatureSettingsRaw): DecryptedNomenclature => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptNomenclature(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.systemSettings.nomenclature.get.useQuery(
    { systemId },
    {
      enabled: masterKey !== null,
      select: selectNomenclature,
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
