import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import after all mocks — vitest hoists vi.mock() calls above this
import RootLayout from "../_layout.js";

import type { TokenStore } from "../../src/auth/token-store.js";
import type { PlatformContext } from "../../src/platform/types.js";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("react-native", () => ({
  ActivityIndicator: ({ size }: { size?: string }) =>
    React.createElement("span", { "data-size": size }, "spinner"),
  View: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  Text: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("span", null, children),
  Pressable: ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) =>
    React.createElement("button", { onClick: onPress }, children),
}));

vi.mock("expo-router", () => ({
  Slot: () => React.createElement("span", null, "slot"),
  Redirect: ({ href }: { href: string }) => React.createElement("span", null, `redirect:${href}`),
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
}));

vi.mock("../../src/i18n/index.js", () => ({
  detectLocale: (locales: string[]): string => mockDetectLocale(locales),
  applyLayoutDirection: (locale: string): void => {
    mockApplyLayoutDirection(locale);
  },
}));

vi.mock("../../locales", () => ({
  resources: {},
}));

vi.mock("@pluralscape/i18n", () => ({
  DEFAULT_LOCALE: "en",
  SUPPORTED_LOCALES: ["en"],
}));

vi.mock("@pluralscape/i18n/react", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
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

// ── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockDetectLocale.mockReturnValue("en");
});

describe("RootLayout", () => {
  it("renders loading state when platform is not yet detected", () => {
    // detectPlatform never resolves — component stays in loading state
    mockDetectPlatform.mockReturnValue(new Promise(() => {}));

    const html = renderToString(React.createElement(RootLayout));
    expect(html).toBeDefined();
    expect(html.length).toBeGreaterThan(0);
    // Should not contain slot or redirect since still loading
    expect(html).not.toContain("slot");
    expect(html).not.toContain("redirect");
  });

  it("does not throw when rendered", () => {
    mockDetectPlatform.mockReturnValue(new Promise(() => {}));

    expect(() => {
      renderToString(React.createElement(RootLayout));
    }).not.toThrow();
  });
});
