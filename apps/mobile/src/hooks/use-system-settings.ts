import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptNomenclature,
  decryptSystemSettings,
} from "@pluralscape/data/transforms/system-settings";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToSystemSettings } from "../data/row-transforms.js";
import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import { type DataQuery, type TRPCMutation } from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  DecryptedNomenclature,
  NomenclatureSettingsRaw,
  SystemSettingsRaw,
} from "@pluralscape/data/transforms/system-settings";
import type { NomenclatureSettings, SystemSettings } from "@pluralscape/types";

export function useSystemSettings(): DataQuery<SystemSettings> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const systemId = useActiveSystemId();
  const masterKey = useMasterKey();

  const selectSystemSettings = useCallback(
    (raw: SystemSettingsRaw): SystemSettings => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptSystemSettings(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["system_settings", systemId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM system_settings WHERE system_id = ?", [systemId]);
      if (!row) throw new Error("System settings not found");
      return rowToSystemSettings(row);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.systemSettings.settings.get.useQuery(
    { systemId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectSystemSettings,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useNomenclature(): DataQuery<DecryptedNomenclature | NomenclatureSettings> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const systemId = useActiveSystemId();
  const masterKey = useMasterKey();

  const selectNomenclature = useCallback(
    (raw: NomenclatureSettingsRaw): DecryptedNomenclature => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptNomenclature(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["system_settings", "nomenclature", systemId],
    queryFn: (): NomenclatureSettings => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT nomenclature FROM system_settings WHERE system_id = ?", [
        systemId,
      ]);
      if (!row) throw new Error("System settings not found");
      const raw = row["nomenclature"];
      if (typeof raw === "string") return JSON.parse(raw) as NomenclatureSettings;
      return raw as NomenclatureSettings;
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.systemSettings.nomenclature.get.useQuery(
    { systemId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectNomenclature,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
