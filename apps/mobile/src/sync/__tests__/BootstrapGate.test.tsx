// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BootstrapGate } from "../BootstrapGate.js";

import type { SyncContextValue } from "../sync-context.js";

afterEach(() => {
  cleanup();
});

function makeSyncValue(overrides: Partial<SyncContextValue> = {}): SyncContextValue {
  return {
    engine: null,
    isBootstrapped: false,
    progress: null,
    bootstrapError: null,
    bootstrapAttempts: 0,
    retryBootstrap: vi.fn(),
    fallbackToRemote: false,
    ...overrides,
  };
}

let mockSyncValue: SyncContextValue = makeSyncValue();

vi.mock("../sync-context.js", () => ({
  useSync: () => mockSyncValue,
}));

describe("BootstrapGate", () => {
  it("renders loading indicator text when not bootstrapped and no error", () => {
    mockSyncValue = makeSyncValue({ isBootstrapped: false });

    render(
      <BootstrapGate>
        <span>child content</span>
      </BootstrapGate>,
    );

    expect(screen.queryByText("child content")).toBeNull();
    // getByText throws if the element is missing; the textContent check
    // confirms the exact user-visible copy rendered by the loading state.
    expect(screen.getByText(/Setting up offline data/).textContent).toMatch(
      /^Setting up offline data/,
    );
  });

  it("renders children when bootstrapped", () => {
    mockSyncValue = makeSyncValue({ isBootstrapped: true });

    render(
      <BootstrapGate>
        <span>child content</span>
      </BootstrapGate>,
    );

    expect(screen.getByText("child content").textContent).toBe("child content");
  });

  it("renders error state with retry button when bootstrapError is set", () => {
    const retryFn = vi.fn();
    mockSyncValue = makeSyncValue({
      isBootstrapped: false,
      bootstrapError: new Error("disk full"),
      bootstrapAttempts: 1,
      retryBootstrap: retryFn,
    });

    render(
      <BootstrapGate>
        <span>child content</span>
      </BootstrapGate>,
    );

    expect(screen.queryByText("child content")).toBeNull();
    const errorText = screen.getByText(/Offline setup failed \(attempt 1\): disk full/);
    expect(errorText.textContent).toMatch(/disk full/);
    expect(errorText.textContent).toMatch(/attempt 1/);
    const retryBtn = screen.getByRole("button", { name: "Retry offline setup" });
    expect(retryBtn.textContent).toBe("Retry");
  });

  it("retry button calls retryBootstrap on press", () => {
    const retryFn = vi.fn();
    mockSyncValue = makeSyncValue({
      isBootstrapped: false,
      bootstrapError: new Error("timeout"),
      bootstrapAttempts: 2,
      retryBootstrap: retryFn,
    });

    render(
      <BootstrapGate>
        <span>child content</span>
      </BootstrapGate>,
    );

    screen.getByRole("button", { name: "Retry offline setup" }).click();
    expect(retryFn).toHaveBeenCalledOnce();
  });

  it("renders children with fallback banner when fallbackToRemote is true", () => {
    mockSyncValue = makeSyncValue({ fallbackToRemote: true, isBootstrapped: false });

    render(
      <BootstrapGate>
        <span>child content</span>
      </BootstrapGate>,
    );

    expect(screen.getByText("child content").textContent).toBe("child content");
    const banner = screen.getByText(/Couldn't set up offline data/);
    expect(banner.textContent).toMatch(/using online mode/);
  });

  it("error state is not shown when fallbackToRemote is true (fallback takes priority)", () => {
    mockSyncValue = makeSyncValue({
      fallbackToRemote: true,
      bootstrapError: new Error("fail"),
      bootstrapAttempts: 3,
      isBootstrapped: false,
    });

    render(
      <BootstrapGate>
        <span>child content</span>
      </BootstrapGate>,
    );

    expect(screen.queryByRole("button", { name: "Retry offline setup" })).toBeNull();
    expect(screen.getByText("child content").textContent).toBe("child content");
  });
});
