import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { usePlatform } from "../platform/index.js";

import { useSync } from "./SyncProvider.js";

import type { ReactNode } from "react";

/**
 * Gates app content behind sync bootstrap when local SQLite is available.
 *
 * On first launch, the sync engine must complete its initial bootstrap before
 * data hooks are safe to use. This component shows a progress indicator while
 * that bootstrap is in progress.
 *
 * When the platform has no SQLite backend (tRPC-only mode), the gate is
 * bypassed immediately and children render without any loading screen.
 */
export function BootstrapGate({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const platform = usePlatform();
  const sync = useSync();

  // No local DB → tRPC mode, no bootstrap needed
  if (platform.storage.backend !== "sqlite") {
    return <>{children}</>;
  }

  // Local DB exists but sync not ready → show loading screen
  if (!sync.isBootstrapped) {
    const progressText =
      sync.progress !== null
        ? `Setting up (${String(sync.progress.synced)}/${String(sync.progress.total)})...`
        : "Setting up your data...";

    return (
      <View
        style={styles.container}
        accessibilityLabel="Loading your data"
        accessibilityRole="none"
      >
        <ActivityIndicator size="large" accessibilityLabel="Loading indicator" />
        <Text style={styles.text}>{progressText}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { marginTop: 16, fontSize: 16, color: "#666" },
});
