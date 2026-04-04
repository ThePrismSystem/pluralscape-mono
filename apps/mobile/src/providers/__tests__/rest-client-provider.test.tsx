// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PropsWithChildren } from "react";

const mockClient = { GET: vi.fn(), POST: vi.fn() };

vi.mock("@pluralscape/api-client", () => ({
  createApiClient: vi.fn(() => mockClient),
}));

vi.mock("../../config.js", () => ({
  getApiBaseUrl: () => "https://api.test.local",
}));

const { RestClientProvider, useRestClient } = await import("../rest-client-provider.js");

function makeWrapper(getToken: () => string | null) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <RestClientProvider getToken={getToken}>{children}</RestClientProvider>;
  };
}

describe("RestClientProvider", () => {
  it("provides the REST client to children", () => {
    const { result } = renderHook(() => useRestClient(), {
      wrapper: makeWrapper(() => null),
    });
    expect(result.current).toBe(mockClient);
  });

  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useRestClient());
    }).toThrow("useRestClient must be used within a RestClientProvider");
  });
});
