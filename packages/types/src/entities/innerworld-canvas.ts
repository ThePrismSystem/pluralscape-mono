import type { SystemId } from "../ids.js";

/** The viewport state for the innerworld canvas. */
export interface InnerWorldCanvas {
  readonly systemId: SystemId;
  readonly viewportX: number;
  readonly viewportY: number;
  readonly zoom: number;
  readonly dimensions: { readonly width: number; readonly height: number };
}
