import { createContext, useContext } from "react";

import type { PlatformContext } from "./types.js";
import type { ReactNode } from "react";

const Ctx = createContext<PlatformContext | null>(null);

export function PlatformProvider({
  context,
  children,
}: {
  readonly context: PlatformContext;
  readonly children: ReactNode;
}): React.JSX.Element {
  return <Ctx.Provider value={context}>{children}</Ctx.Provider>;
}

export function usePlatform(): PlatformContext {
  const ctx = useContext(Ctx);
  if (ctx === null) {
    throw new Error("usePlatform must be used within PlatformProvider");
  }
  return ctx;
}
