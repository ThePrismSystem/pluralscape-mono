import { groupHierarchy } from "./internal.js";

// Factory method re-exports — TS inference propagates cleanly now.
// Previously needed explicit type annotations (see api-5psf).
export const createGroup = groupHierarchy.create;
