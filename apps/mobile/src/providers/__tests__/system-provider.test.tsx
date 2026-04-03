// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SystemProvider, useActiveSystemId } from "../system-provider.js";

import type { SystemId } from "@pluralscape/types";
import type { PropsWithChildren } from "react";

function makeWrapper(systemId: SystemId | null) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <SystemProvider systemId={systemId}>{children}</SystemProvider>;
  };
}

describe("useActiveSystemId", () => {
  it("returns the systemId from the provider", () => {
    const { result } = renderHook(() => useActiveSystemId(), {
      wrapper: makeWrapper("sys_test123" as SystemId),
    });
    expect(result.current).toBe("sys_test123");
  });

  it("throws when no SystemProvider is present", () => {
    expect(() => {
      renderHook(() => useActiveSystemId());
    }).toThrow("useActiveSystemId must be used within a SystemProvider");
  });

  it("throws when systemId is null", () => {
    expect(() => {
      renderHook(() => useActiveSystemId(), {
        wrapper: makeWrapper(null),
      });
    }).toThrow("No active system selected");
  });
});
