import { groupHierarchy } from "./internal.js";

// Re-exports; TS infers cleanly now.
export const deleteGroup = groupHierarchy.remove;
export const archiveGroup = groupHierarchy.archive;
export const restoreGroup = groupHierarchy.restore;
