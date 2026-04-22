import { groupHierarchy } from "./internal.js";

// Re-exports; TS infers cleanly now (api-5psf).
export const deleteGroup = groupHierarchy.remove;
export const archiveGroup = groupHierarchy.archive;
export const restoreGroup = groupHierarchy.restore;
