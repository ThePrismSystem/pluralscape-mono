import { createAppQueryClient } from "@pluralscape/data";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@pluralscape/i18n";
import { I18nProvider } from "@pluralscape/i18n/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Slot } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { resources } from "../locales";
import { AuthProvider, AuthStateMachine, createTokenStore, useAuth } from "../src/auth/index.js";
import { getApiBaseUrl } from "../src/config.js";
import { ConnectionManager, ConnectionProvider } from "../src/connection/index.js";
import { applyLayoutDirection, detectLocale } from "../src/i18n/index.js";
import { detectPlatform, PlatformProvider } from "../src/platform/index.js";
import { BucketKeyProvider } from "../src/providers/bucket-key-provider.js";
import { CryptoProvider } from "../src/providers/crypto-provider.js";
import { RestClientProvider } from "../src/providers/rest-client-provider.js";
import { SystemProvider } from "../src/providers/system-provider.js";
import { TRPCProvider } from "../src/providers/trpc-provider.js";
import { SyncProvider } from "../src/sync/index.js";

import type { TokenStore } from "../src/auth/index.js";
import type { PlatformContext } from "../src/platform/index.js";
import type { ReactNode } from "react";

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  retryButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  lockSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
});

function LoadingSpinner(): React.JSX.Element {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" />
    </View>
  );
}

function ErrorScreen({
  error,
  onRetry,
}: {
  readonly error: Error;
  readonly onRetry: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{"Initialization failed"}</Text>
      <Text style={styles.errorMessage}>
        {__DEV__ ? error.message : "An unexpected error occurred. Please try again."}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry initialization"
        style={styles.retryButton}
      >
        <Text style={styles.retryButtonText}>{"Retry"}</Text>
      </Pressable>
    </View>
  );
}

function LockScreen(): React.JSX.Element {
  return (
    <View style={styles.centered}>
      <Text style={styles.lockTitle}>{"App Locked"}</Text>
      <Text style={styles.lockSubtitle}>
        {"Unlock to continue. Biometric/PIN unlock coming soon."}
      </Text>
    </View>
  );
}

function AuthBridgeProviders({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const { snapshot } = useAuth();
  const systemId = snapshot.credentials?.systemId ?? null;
  const masterKey = snapshot.state === "unlocked" ? snapshot.session.masterKey : null;
  const boxKeypair = snapshot.state === "unlocked" ? snapshot.session.identityKeys.box : null;

  return (
    <SystemProvider systemId={systemId}>
      <CryptoProvider masterKey={masterKey}>
        {boxKeypair ? (
          <BucketKeyProvider boxKeypair={boxKeypair}>{children}</BucketKeyProvider>
        ) : (
          children
        )}
      </CryptoProvider>
    </SystemProvider>
  );
}

function AuthGate({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const { snapshot } = useAuth();

  if (snapshot.state === "unauthenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  if (snapshot.state === "locked") {
    return <LockScreen />;
  }

  return <>{children}</>;
}

export default function RootLayout(): React.JSX.Element {
  const [platform, setPlatform] = useState<PlatformContext | null>(null);
  const [tokenStore, setTokenStore] = useState<TokenStore | null>(null);
  const [initError, setInitError] = useState<Error | null>(null);
  const [locale, setLocale] = useState(DEFAULT_LOCALE);

  const queryClientRef = useRef<ReturnType<typeof createAppQueryClient> | null>(null);
  queryClientRef.current ??= createAppQueryClient();

  const authMachineRef = useRef<AuthStateMachine | null>(null);
  authMachineRef.current ??= new AuthStateMachine();

  const connectionConfig = useMemo(
    () => ({
      baseUrl: getApiBaseUrl(),
      maxBackoffMs: 30_000,
      baseBackoffMs: 1_000,
    }),
    [],
  );

  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  connectionManagerRef.current ??= new ConnectionManager(connectionConfig);

  const initPlatform = useCallback(() => {
    setInitError(null);
    setPlatform(null);
    setTokenStore(null);

    void detectPlatform()
      .then(setPlatform)
      .catch((err: unknown) => {
        setInitError(err instanceof Error ? err : new Error(String(err)));
      });
  }, []);

  useEffect(() => {
    initPlatform();
  }, [initPlatform]);

  useEffect(() => {
    const detected = detectLocale(SUPPORTED_LOCALES);
    setLocale(detected);
    applyLayoutDirection(detected);
  }, []);

  useEffect(() => {
    if (platform === null) return;
    void createTokenStore(platform.capabilities)
      .then(setTokenStore)
      .catch((err: unknown) => {
        setInitError(err instanceof Error ? err : new Error(String(err)));
      });
  }, [platform]);

  if (initError !== null) {
    return <ErrorScreen error={initError} onRetry={initPlatform} />;
  }

  if (platform === null || tokenStore === null) {
    return <LoadingSpinner />;
  }

  const getToken = useCallback(() => tokenStore.getToken(), [tokenStore]);

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
          <TRPCProvider
            queryClient={queryClientRef.current}
            getToken={getToken}
            onUnauthorized={() => authMachineRef.current?.dispatch({ type: "LOGOUT" })}
          >
            <RestClientProvider getToken={getToken}>
              <AuthProvider machine={authMachineRef.current} tokenStore={tokenStore}>
                <AuthBridgeProviders>
                  <ConnectionProvider manager={connectionManagerRef.current}>
                    <SyncProvider>
                      <AuthGate>
                        <Slot />
                      </AuthGate>
                    </SyncProvider>
                  </ConnectionProvider>
                </AuthBridgeProviders>
              </AuthProvider>
            </RestClientProvider>
          </TRPCProvider>
        </QueryClientProvider>
      </I18nProvider>
    </PlatformProvider>
  );
}
