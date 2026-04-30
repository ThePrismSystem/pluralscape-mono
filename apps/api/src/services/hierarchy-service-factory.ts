/**
 * Hierarchy service factory — public barrel.
 *
 * Callers import `createHierarchyService` from this path. The implementation
 * is split by verb across `hierarchy-service-factory/` sub-modules.
 */
export { createHierarchyService } from "./hierarchy-service-factory/factory.js";
