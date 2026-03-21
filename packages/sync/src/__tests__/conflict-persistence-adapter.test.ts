/**
 * ConflictPersistenceAdapter contract test runner.
 *
 * Runs the contract suite against the in-memory reference implementation,
 * ensuring the contract itself is valid and complete.
 */
import {
  InMemoryConflictPersistenceAdapter,
  runConflictPersistenceContract,
} from "./conflict-persistence.contract.js";

runConflictPersistenceContract(() => new InMemoryConflictPersistenceAdapter());
