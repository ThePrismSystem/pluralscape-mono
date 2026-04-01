import { createAppQueryClient } from "@pluralscape/data";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@pluralscape/i18n";
import { I18nProvider } from "@pluralscape/i18n/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Slot } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { resources } from "../locales";
import { AuthProvider, AuthStateMachine, createTokenStore, useAuth } from "../src/auth/index.js";
import { ConnectionManager, ConnectionProvider } from "../src/connection/index.js";
import { applyLayoutDirection, detectLocale } from "../src/i18n/index.js";
import { detectPlatform, PlatformProvider } from "../src/platform/index.js";
import { SyncProvider } from "../src/sync/index.js";

import type { TokenStore } from "../src/auth/index.js";
import type { PlatformContext } from "../src/platform/index.js";
import type { ReactNode } from "react";

const CONNECTION_CONFIG = {
  baseUrl: "http://localhost:3000",
  maxBackoffMs: 30_000,
  baseBackoffMs: 1_000,
};

function LoadingSpinner(): React.JSX.Element {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

function AuthGate({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const { state } = useAuth();

  if (state === "unauthenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  if (state === "locked") {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}

export default function RootLayout(): React.JSX.Element {
  const [platform, setPlatform] = useState<PlatformContext | null>(null);
  const [tokenStore, setTokenStore] = useState<TokenStore | null>(null);
  const [locale, setLocale] = useState(DEFAULT_LOCALE);

  const queryClientRef = useRef<ReturnType<typeof createAppQueryClient> | null>(null);
  queryClientRef.current ??= createAppQueryClient();

  const authMachineRef = useRef<AuthStateMachine | null>(null);
  authMachineRef.current ??= new AuthStateMachine();

  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  connectionManagerRef.current ??= new ConnectionManager(CONNECTION_CONFIG);

  useEffect(() => {
    void detectPlatform()
      .then(setPlatform)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const detected = detectLocale(SUPPORTED_LOCALES);
    setLocale(detected as typeof DEFAULT_LOCALE);
    applyLayoutDirection(detected);
  }, []);

  useEffect(() => {
    if (platform === null) return;
    void createTokenStore(platform.capabilities)
      .then(setTokenStore)
      .catch(() => undefined);
  }, [platform]);

  if (platform === null || tokenStore === null) {
    return <LoadingSpinner />;
  }

  return (
    <PlatformProvider context={platform}>
      <I18nProvider
        config={{
          locale,
          fallbackLocale: DEFAULT_LOCALE,
          resources,
        }}
      >
        <QueryClientProvider client={queryClientRef.current}>
          <AuthProvider machine={authMachineRef.current} tokenStore={tokenStore}>
            <ConnectionProvider manager={connectionManagerRef.current}>
              <SyncProvider>
                <AuthGate>
                  <Slot />
                </AuthGate>
              </SyncProvider>
            </ConnectionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </I18nProvider>
    </PlatformProvider>
  );
}
