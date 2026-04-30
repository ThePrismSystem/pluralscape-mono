/**
 * Barrel index for test factories.
 *
 * Re-exports all factory functions so existing consumers that import from
 * `__tests__/factories.js` can be updated to import from `__tests__/factories/index.js`
 * (or specific sub-files for leaner imports).
 */
export { NOW, TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./shared.js";
export { makeRawCustomFront, makeRawMember } from "./member.js";
export {
  makeRawFrontingComment,
  makeRawFrontingReport,
  makeRawFrontingSession,
  makeRawGroup,
} from "./fronting.js";
export {
  makeRawAcknowledgement,
  makeRawBoardMessage,
  makeRawChannel,
  makeRawMessage,
  makeRawPoll,
  makeRawPollVote,
} from "./comms.js";
export {
  INNERWORLD_DEFAULT_VISUAL,
  makeRawCanvas,
  makeRawInnerworldEntity,
  makeRawInnerworldRegion,
  makeRawStructureEntity,
  makeRawStructureEntityType,
} from "./structure-innerworld.js";
export {
  makeRawCheckIn,
  makeRawFieldDefinition,
  makeRawFieldValue,
  makeRawLifecycleEvent,
  makeRawNomenclature,
  makeRawNote,
  makeRawRelationship,
  makeRawSnapshot,
  makeRawSystemSettings,
  makeRawTimer,
} from "./misc.js";
