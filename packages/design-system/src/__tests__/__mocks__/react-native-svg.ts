import { createElement, type ReactNode } from "react";

type StubProps = Readonly<Record<string, unknown>> & { readonly children?: ReactNode };

function stub(tag: string) {
  return ({ children, ...props }: StubProps) => createElement(tag, props, children);
}

export const Svg = stub("svg");
export const Circle = stub("circle");
export const Ellipse = stub("ellipse");
export const G = stub("g");
export const Line = stub("line");
export const Path = stub("path");
export const Polygon = stub("polygon");
export const Polyline = stub("polyline");
export const Rect = stub("rect");
export const Text = stub("text");
export const TSpan = stub("tspan");
export const TextPath = stub("textpath");
export const Use = stub("use");
export const Defs = stub("defs");
export const Stop = stub("stop");
export const LinearGradient = stub("linearGradient");
export const RadialGradient = stub("radialGradient");
export const ClipPath = stub("clipPath");
export const Pattern = stub("pattern");
export const Mask = stub("mask");
export const Symbol = stub("symbol");
export const Marker = stub("marker");
export const ForeignObject = stub("foreignObject");
export const Image = stub("image");

export default Svg;
