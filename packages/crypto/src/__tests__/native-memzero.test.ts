import { describe, expect, it, vi } from "vitest";

import { wrapNativeMemzero } from "../adapter/native-memzero.js";

import type { NativeMemzero } from "../lifecycle-types.js";

describe("wrapNativeMemzero", () => {
  it("returns an object with a memzero method", () => {
    const fn = vi.fn();
    const result = wrapNativeMemzero(fn);
    expect(result).toHaveProperty("memzero");
    expect(typeof result.memzero).toBe("function");
  });

  it("satisfies the NativeMemzero interface", () => {
    const fn = vi.fn();
    const result: NativeMemzero = wrapNativeMemzero(fn);
    expect(typeof result.memzero).toBe("function");
  });

  it("delegates to the provided function", () => {
    const fn = vi.fn();
    const wrapper = wrapNativeMemzero(fn);
    const buffer = new Uint8Array([1, 2, 3]);
    wrapper.memzero(buffer);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(buffer);
  });

  it("passes through the exact buffer reference", () => {
    let receivedBuffer: Uint8Array | null = null;
    const fn = vi.fn((buf: Uint8Array) => {
      receivedBuffer = buf;
    });
    const wrapper = wrapNativeMemzero(fn);
    const buffer = new Uint8Array([4, 5, 6]);
    wrapper.memzero(buffer);
    expect(receivedBuffer).toBe(buffer);
  });

  it("can be called multiple times", () => {
    const fn = vi.fn();
    const wrapper = wrapNativeMemzero(fn);
    wrapper.memzero(new Uint8Array(8));
    wrapper.memzero(new Uint8Array(16));
    wrapper.memzero(new Uint8Array(32));
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
