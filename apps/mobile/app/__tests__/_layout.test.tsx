// @vitest-environment happy-dom
import { cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

// React Native's runtime exposes __DEV__ as a global — happy-dom does not.
// Define it before mocks execute so RootLayout's ErrorScreen branch works.
interface GlobalWithDev {
  __DEV__: boolean;
}
(globalThis as Partial<GlobalWithDev>).__DEV__ = true;

// Import after all mocks — vitest hoists vi.mock() calls above this
import RootLayout from "../_layout.js";

import type { TokenStore } from "../../src/auth/token-store.js";
import type { PlatformContext } from "../../src/platform/types.js";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("react-native", () => ({
  ActivityIndicator: ({ size }: { size?: string }) =>
    React.createElement("span", { "data-testid": "spinner", "data-size": size }, "spinner"),
  View: ({ children, ...rest }: { children?: React.ReactNode }) =>
    React.createElement("div", rest, children),
  Text: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("span", null, children),
  Pressable: ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
  }) =>
    React.createElement("button", { onClick: onPress, "aria-label": accessibilityLabel }, children),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
  },
}));

vi.mock("expo-router", () => ({
  Slot: () => React.createElement("span", { "data-testid": "slot" }, "slot"),
  Redirect: ({ href }: { href: string }) =>
    React.createElement("span", { "data-testid": "redirect" }, `redirect:${href}`),
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { apiBaseUrl: "http://test:3000" } } },
}));

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(),
}));

const mockDetectPlatform = vi.fn<() => Promise<PlatformContext>>();
const mockCreateTokenStore = vi.fn<() => Promise<TokenStore>>();
const mockDetectLocale = vi.fn<(locales: string[]) => string>().mockReturnValue("en");
const mockApplyLayoutDirection = vi.fn<(locale: string) => void>();
const mockCreateChainedBackend = vi.fn(() => ({ type: "backend" as const, read: vi.fn() }));
const mockLoadBundledNamespace = vi.fn(
  (locale: string, namespace: string): Promise<Readonly<Record<string, string>>> => {
    void locale;
    void namespace;
    return Promise.resolve({});
  },
);

vi.mock("../../src/platform/index.js", () => ({
  detectPlatform: (...args: unknown[]) => mockDetectPlatform(...(args as [])),
  PlatformProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  usePlatform: () => ({}),
}));

vi.mock("../../src/auth/index.js", async () => {
  const { AuthStateMachine } = await import("../../src/auth/auth-state-machine.js");
  return {
    AuthStateMachine,
    createTokenStore: (...args: unknown[]) => mockCreateTokenStore(...(args as [])),
    AuthProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useAuth: () => ({
      snapshot: { state: "unauthenticated", session: null, credentials: null },
      login: vi.fn(),
      logout: vi.fn(),
      lock: vi.fn(),
      unlock: vi.fn(),
    }),
  };
});

vi.mock("../../src/connection/index.js", () => ({
  ConnectionManager: class MockConnectionManager {
    getSnapshot() {
      return "disconnected";
    }
    subscribe() {
      return () => {};
    }
    connect() {}
    disconnect() {}
    getLastError() {
      return null;
    }
  },
  ConnectionProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useConnection: () => ({ status: "disconnected", manager: {} }),
}));

vi.mock("../../src/sync/index.js", () => ({
  SyncProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useSync: () => ({ engine: null, isBootstrapped: false }),
  BootstrapGate: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("../../src/data/index.js", () => ({
  DataLayerProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("../../src/providers/bucket-key-provider.js", () => ({
  BucketKeyProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("../../src/providers/crypto-provider.js", () => ({
  CryptoProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("../../src/providers/rest-client-provider.js", () => ({
  RestClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("../../src/providers/system-provider.js", () => ({
  SystemProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("../../src/providers/trpc-provider.js", () => ({
  TRPCProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("../../src/i18n/index.js", () => ({
  detectLocale: (locales: string[]): string => mockDetectLocale(locales),
  applyLayoutDirection: (locale: string): void => {
    mockApplyLayoutDirection(locale);
  },
  AsyncStorageI18nCache: class MockCache {
    read(): Promise<null> {
      return Promise.resolve(null);
    }
    write(): Promise<void> {
      return Promise.resolve();
    }
    isFresh(): boolean {
      return false;
    }
  },
  createChainedBackend: (...args: unknown[]): { type: "backend"; read: () => void } =>
    mockCreateChainedBackend(...(args as [])),
}));

vi.mock("../../locales", () => ({
  BUNDLED_NAMESPACES: ["common", "auth", "fronting", "members", "settings"],
  loadBundledNamespace: (
    locale: string,
    namespace: string,
  ): Promise<Readonly<Record<string, string>>> => mockLoadBundledNamespace(locale, namespace),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((): Promise<string | null> => Promise.resolve(null)),
    setItem: vi.fn((): Promise<void> => Promise.resolve()),
    removeItem: vi.fn((): Promise<void> => Promise.resolve()),
  },
}));

vi.mock("@pluralscape/i18n", () => ({
  DEFAULT_LOCALE: "en",
  SUPPORTED_LOCALES: ["en"],
}));

vi.mock("@pluralscape/types", () => ({
  MS_PER_HOUR: 3_600_000,
}));

vi.mock("@pluralscape/i18n/react", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("@pluralscape/crypto", () => ({
  getSodium: () => ({ memzero: vi.fn() }),
}));

vi.mock("@pluralscape/data", () => ({
  createAppQueryClient: () => ({
    defaultOptions: {},
    mount: vi.fn(),
    unmount: vi.fn(),
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// ── Helpers ─────────────────────────────────────────────────────────

function makePlatformContext(): PlatformContext {
  // Providers are all mocked to Fragments in this test; the concrete shape of
  // these adapters is never inspected. Build fully-typed vitest-mock-extended
  // stubs so the PlatformContext typecheck succeeds without `as` casts.
  return {
    capabilities: {
      hasSecureStorage: false,
      hasBiometric: false,
      hasBackgroundSync: false,
      hasNativeMemzero: false,
      storageBackend: "indexeddb",
    },
    storage: {
      backend: "indexeddb",
      storageAdapter: mock(),
      offlineQueueAdapter: mock(),
    },
    crypto: mock(),
  };
}

function makeTokenStore(): TokenStore {
  return {
    getToken: () => Promise.resolve(null),
    setToken: () => Promise.resolve(),
    clearToken: () => Promise.resolve(),
  };
}

// ── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockDetectLocale.mockReturnValue("en");
});

afterEach(() => {
  cleanup();
});

describe("RootLayout — loading state", () => {
  it("renders spinner while platform detection is pending", () => {
    // detectPlatform never resolves — component stays in loading state
    mockDetectPlatform.mockReturnValue(new Promise(() => {}));

    const { getByTestId, queryByTestId } = render(<RootLayout />);

    expect(getByTestId("spinner")).toHaveProperty("tagName", "SPAN");
    // Should not render slot or redirect — still loading
    expect(queryByTestId("slot")).toBeNull();
    expect(queryByTestId("redirect")).toBeNull();
  });

  it("renders spinner while token store creation is pending", async () => {
    mockDetectPlatform.mockResolvedValue(makePlatformContext());
    mockCreateTokenStore.mockReturnValue(new Promise(() => {}));

    const { findByTestId, queryByTestId } = render(<RootLayout />);

    // Platform resolves, but token store never resolves — still loading
    const spinner = await findByTestId("spinner");
    expect(spinner.tagName).toBe("SPAN");
    expect(queryByTestId("slot")).toBeNull();
    expect(queryByTestId("redirect")).toBeNull();
  });
});

describe("RootLayout — loaded state", () => {
  it("renders the redirect to login once platform and token store are ready (unauthenticated)", async () => {
    mockDetectPlatform.mockResolvedValue(makePlatformContext());
    mockCreateTokenStore.mockResolvedValue(makeTokenStore());

    const { findByTestId, queryByTestId } = render(<RootLayout />);

    // AuthGate sees unauthenticated snapshot and renders <Redirect href="/(auth)/login" />.
    const redirect = await findByTestId("redirect");
    expect(redirect.textContent).toBe("redirect:/(auth)/login");
    expect(queryByTestId("spinner")).toBeNull();
  });

  it("applies detected locale on mount", async () => {
    mockDetectPlatform.mockResolvedValue(makePlatformContext());
    mockCreateTokenStore.mockResolvedValue(makeTokenStore());
    mockDetectLocale.mockReturnValue("fr");

    render(<RootLayout />);

    await waitFor(() => {
      expect(mockApplyLayoutDirection).toHaveBeenCalledWith("fr");
    });
    expect(mockDetectLocale).toHaveBeenCalledWith(["en"]);
  });
});

describe("RootLayout — error state", () => {
  it("renders error screen when platform detection rejects", async () => {
    mockDetectPlatform.mockRejectedValue(new Error("platform boom"));

    const { findByRole, queryByTestId } = render(<RootLayout />);

    const retryBtn = await findByRole("button", { name: "Retry initialization" });
    expect(retryBtn.tagName).toBe("BUTTON");
    expect(queryByTestId("slot")).toBeNull();
    expect(queryByTestId("redirect")).toBeNull();
  });

  it("renders error screen when token store creation rejects", async () => {
    mockDetectPlatform.mockResolvedValue(makePlatformContext());
    mockCreateTokenStore.mockRejectedValue(new Error("token store boom"));

    const { findByRole } = render(<RootLayout />);

    const retryBtn = await findByRole("button", { name: "Retry initialization" });
    expect(retryBtn.tagName).toBe("BUTTON");
  });

  it("retry button re-runs platform detection after error", async () => {
    mockDetectPlatform.mockRejectedValueOnce(new Error("transient"));
    mockDetectPlatform.mockResolvedValueOnce(makePlatformContext());
    mockCreateTokenStore.mockResolvedValue(makeTokenStore());

    const { findByRole, findByTestId } = render(<RootLayout />);

    const retryBtn = await findByRole("button", { name: "Retry initialization" });
    retryBtn.click();

    // After retry, the second detectPlatform resolve leads past loading to
    // the redirect rendered by AuthGate.
    const redirect = await findByTestId("redirect");
    expect(redirect.textContent).toBe("redirect:/(auth)/login");
    expect(mockDetectPlatform).toHaveBeenCalledTimes(2);
  });
});
