import { groupHierarchy } from "./internal.js";

// Re-export; TS infers cleanly now (api-5psf).
export const updateGroup = groupHierarchy.update;
