import { groupHierarchy } from "./internal.js";

// Re-export; TS infers cleanly now.
export const createGroup = groupHierarchy.create;
