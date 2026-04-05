import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import {
  BOOTSTRAP_INDICATOR_MARGIN,
  BOOTSTRAP_TEXT_COLOR,
  BOOTSTRAP_TEXT_SIZE,
  MIN_TOUCH_TARGET,
} from "./bootstrap-gate.constants.js";
import { useSync } from "./sync-context.js";

import type { ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  indicator: {
    marginBottom: BOOTSTRAP_INDICATOR_MARGIN,
  },
  text: {
    fontSize: BOOTSTRAP_TEXT_SIZE,
    color: BOOTSTRAP_TEXT_COLOR,
  },
  errorText: {
    fontSize: BOOTSTRAP_TEXT_SIZE,
    color: BOOTSTRAP_TEXT_COLOR,
    textAlign: "center",
    marginBottom: BOOTSTRAP_INDICATOR_MARGIN,
  },
  retryButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: BOOTSTRAP_INDICATOR_MARGIN,
  },
  retryText: {
    fontSize: BOOTSTRAP_TEXT_SIZE,
    color: "#007AFF",
  },
  banner: {
    backgroundColor: "#FFF3CD",
    padding: BOOTSTRAP_INDICATOR_MARGIN,
  },
  bannerText: {
    fontSize: BOOTSTRAP_TEXT_SIZE,
    color: BOOTSTRAP_TEXT_COLOR,
  },
});

export function BootstrapGate({ children }: Props): React.JSX.Element {
  const sync = useSync();

  if (sync.fallbackToRemote) {
    return (
      <>
        <View
          style={styles.banner}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel="Offline data unavailable banner"
        >
          <Text style={styles.bannerText}>
            {"Couldn't set up offline data \u2014 using online mode"}
          </Text>
        </View>
        {children}
      </>
    );
  }

  if (sync.bootstrapError !== null && !sync.isBootstrapped) {
    return (
      <View style={styles.container} accessible={true} accessibilityRole="none">
        <Text style={styles.errorText} accessibilityRole="text">
          {`Offline setup failed (attempt ${sync.bootstrapAttempts.toString()}): ${sync.bootstrapError.message}`}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={sync.retryBootstrap}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Retry offline setup"
          hitSlop={{ top: 0, bottom: 0, left: 0, right: 0 }}
        >
          <Text style={styles.retryText}>{"Retry"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!sync.isBootstrapped) {
    return (
      <View style={styles.container} accessible={true} accessibilityRole="none">
        <ActivityIndicator
          style={styles.indicator}
          accessible={true}
          accessibilityLabel="Setting up offline data"
        />
        <Text style={styles.text}>{"Setting up offline data\u2026"}</Text>
      </View>
    );
  }

  return <>{children}</>;
}
