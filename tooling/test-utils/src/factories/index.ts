/**
 * Factory stubs for test data generation.
 *
 * These produce plain objects with randomized defaults. They will be
 * updated to insert into the database when the schema epic (db-2je4)
 * defines the corresponding tables.
 */

export { buildSystem } from "./system.js";
export { buildMember } from "./member.js";
export { buildFrontingSession } from "./fronting-session.js";
export { buildGroup } from "./group.js";
export { buildBucket } from "./bucket.js";

export type { SystemFactoryInput, SystemFactoryOutput } from "./system.js";
export type { MemberFactoryInput, MemberFactoryOutput } from "./member.js";
export type {
  FrontingSessionFactoryInput,
  FrontingSessionFactoryOutput,
} from "./fronting-session.js";
export type { GroupFactoryInput, GroupFactoryOutput } from "./group.js";
export type { BucketFactoryInput, BucketFactoryOutput } from "./bucket.js";
