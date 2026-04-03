import { createContext, useContext } from "react";

import type { SystemId } from "@pluralscape/types";
import type { PropsWithChildren } from "react";

interface SystemContextValue {
  readonly systemId: SystemId | null;
}

const SystemContext = createContext<SystemContextValue | null>(null);

export function SystemProvider({
  systemId,
  children,
}: PropsWithChildren<{ systemId: SystemId | null }>): React.JSX.Element {
  return <SystemContext.Provider value={{ systemId }}>{children}</SystemContext.Provider>;
}

export function useActiveSystemId(): SystemId {
  const ctx = useContext(SystemContext);
  if (ctx === null) {
    throw new Error("useActiveSystemId must be used within a SystemProvider");
  }
  if (ctx.systemId === null) {
    throw new Error("No active system selected");
  }
  return ctx.systemId;
}
