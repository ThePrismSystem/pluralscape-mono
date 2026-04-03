import React, { createContext, useContext } from "react";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { PropsWithChildren } from "react";

interface CryptoContextValue {
  readonly masterKey: KdfMasterKey | null;
}

const MISSING_PROVIDER = "useMasterKey must be used within a CryptoProvider";

const CryptoContext = createContext<CryptoContextValue | null>(null);

export function CryptoProvider({
  masterKey,
  children,
}: PropsWithChildren<{ masterKey: KdfMasterKey | null }>): React.JSX.Element {
  return <CryptoContext.Provider value={{ masterKey }}>{children}</CryptoContext.Provider>;
}

export function useMasterKey(): KdfMasterKey | null {
  const ctx = useContext(CryptoContext);
  if (ctx === null) {
    throw new Error(MISSING_PROVIDER);
  }
  return ctx.masterKey;
}
