// Test-only alias for `lucide-react-native`.
//
// Why: the published v1.14.0 ESM main (dist/esm/lucide-react-native.mjs) statically
// re-exports `LucideProvider` from a context.mjs that doesn't define it — Metro/RN's
// lazy resolver tolerates this build artifact bug, but Node/vitest's strict ESM link
// fails. The /icons subpath is clean, but its deep transitive imports drag in
// react-native-svg's RN-typed source which our happy-dom env can't parse.
//
// Each icon is rendered as an SVG element with stroke/size attributes that match
// the real Lucide component shape — enough for atom tests (color routing, theme
// integration) without spinning up the full RN-svg chain.
import { createElement, forwardRef, type ReactElement, type Ref } from "react";

interface IconMockProps {
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly [key: string]: unknown;
}

function makeIconStub(name: string) {
  const Stub = forwardRef<unknown, IconMockProps>(
    (
      { size = 24, color = "currentColor", strokeWidth = 2, ...rest }: IconMockProps,
      ref: Ref<unknown>,
    ): ReactElement =>
      createElement("svg", {
        ref,
        "data-lucide": name,
        width: size,
        height: size,
        stroke: color,
        strokeWidth,
        ...rest,
      }),
  );
  Stub.displayName = name;
  return Stub;
}

export const Check = makeIconStub("Check");
export const X = makeIconStub("X");
export const Plus = makeIconStub("Plus");
export const Minus = makeIconStub("Minus");
export const ChevronDown = makeIconStub("ChevronDown");
export const ChevronUp = makeIconStub("ChevronUp");
export const ChevronLeft = makeIconStub("ChevronLeft");
export const ChevronRight = makeIconStub("ChevronRight");
export const Heart = makeIconStub("Heart");
export const Settings = makeIconStub("Settings");
export const Search = makeIconStub("Search");
export const Eye = makeIconStub("Eye");
export const EyeOff = makeIconStub("EyeOff");

export type LucideIcon = ReturnType<typeof makeIconStub>;
