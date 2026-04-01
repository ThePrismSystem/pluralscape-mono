import { createAppQueryClient } from "@pluralscape/data";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@pluralscape/i18n";
import { I18nProvider } from "@pluralscape/i18n/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Slot } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { resources } from "../locales";
import { AuthProvider, AuthStateMachine, createTokenStore, useAuth } from "../src/auth/index.js";
import { ConnectionManager, ConnectionProvider } from "../src/connection/index.js";
import { applyLayoutDirection, detectLocale } from "../src/i18n/index.js";
import { detectPlatform, PlatformProvider } from "../src/platform/index.js";
import { SyncProvider } from "../src/sync/index.js";

import type { TokenStore } from "../src/auth/index.js";
import type { PlatformContext } from "../src/platform/index.js";

const CONNECTION_CONFIG = {
  baseUrl: "http://localhost:3000",
  wsUrl: "ws://localhost:3000/v1/sync/ws",
  maxBackoffMs: 30_000,
  baseBackoffMs: 1_000,
};

const queryClient = createAppQueryClient();
const authMachine = new AuthStateMachine();
const connectionManager = new ConnectionManager(CONNECTION_CONFIG);

function AuthGate(): React.JSX.Element {
  const { state } = useAuth();

  if (state === "unauthenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  if (state === "locked") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href="/(app)/(tabs)" />;
}

export default function RootLayout(): React.JSX.Element {
  const [platform, setPlatform] = useState<PlatformContext | null>(null);
  const [tokenStore, setTokenStore] = useState<TokenStore | null>(null);
  const [locale, setLocale] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    void detectPlatform().then(setPlatform);
  }, []);

  useEffect(() => {
    const detected = detectLocale(SUPPORTED_LOCALES);
    setLocale(detected as typeof DEFAULT_LOCALE);
    applyLayoutDirection(detected);
  }, []);

  useEffect(() => {
    if (platform === null) return;
    void createTokenStore(platform.capabilities).then(setTokenStore);
  }, [platform]);

  if (platform === null || tokenStore === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
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
        <QueryClientProvider client={queryClient}>
          <AuthProvider machine={authMachine} tokenStore={tokenStore}>
            <ConnectionProvider manager={connectionManager}>
              <SyncProvider>
                <Slot />
                <AuthGate />
              </SyncProvider>
            </ConnectionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </I18nProvider>
    </PlatformProvider>
  );
}
