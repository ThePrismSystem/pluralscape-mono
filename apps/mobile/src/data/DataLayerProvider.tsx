import { createEventBus } from "@pluralscape/sync";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef } from "react";

import { usePlatform } from "../platform/PlatformProvider.js";

import { createLocalDatabase } from "./local-database.js";
import { createQueryInvalidator } from "./query-invalidator.js";

import type { LocalDatabase } from "./local-database.js";
import type { DataLayerEventMap, EventBus } from "@pluralscape/sync";
import type { ReactNode } from "react";

export interface DataLayerContextValue {
  readonly eventBus: EventBus<DataLayerEventMap>;
  readonly localDb: LocalDatabase;
}

const Ctx = createContext<DataLayerContextValue | null>(null);

/** Exported for test helpers only — use {@link useDataLayer} in production code. */
export const DataLayerCtx = Ctx;

export function DataLayerProvider({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  const platform = usePlatform();
  const queryClient = useQueryClient();

  const eventBusRef = useRef<EventBus<DataLayerEventMap> | null>(null);
  eventBusRef.current ??= createEventBus<DataLayerEventMap>();

  const localDbRef = useRef<LocalDatabase | null>(null);
  if (localDbRef.current === null && platform.storage.backend === "sqlite") {
    const db = createLocalDatabase(platform.storage.driver);
    db.initialize();
    localDbRef.current = db;
  }

  useEffect(() => {
    const bus = eventBusRef.current;
    const qc = queryClient;
    if (bus === null) return;

    const cleanupInvalidator = createQueryInvalidator(bus, qc);

    return () => {
      cleanupInvalidator();
    };
  }, [queryClient]);

  useEffect(() => {
    return () => {
      localDbRef.current?.close();
      eventBusRef.current?.removeAll();
    };
  }, []);

  // For non-sqlite backends the localDb ref stays null — the provider cannot
  // yet function without a sqlite driver, so we render children without a
  // context value and useDataLayer will throw if called.  Once IndexedDB
  // support is wired (Task 13+), this guard should be replaced.
  if (localDbRef.current === null) {
    return <>{children}</>;
  }

  const value: DataLayerContextValue = {
    eventBus: eventBusRef.current,
    localDb: localDbRef.current,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDataLayer(): DataLayerContextValue {
  const ctx = useContext(Ctx);
  if (ctx === null) {
    throw new Error("useDataLayer must be used within DataLayerProvider");
  }
  return ctx;
}

export function useDataLayerOptional(): DataLayerContextValue | null {
  return useContext(Ctx);
}
