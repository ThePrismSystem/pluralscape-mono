/**
 * Forbid `as never` casts in test fixtures.
 *
 * Use `brandId<T>(raw)` from `@pluralscape/types` (or `tagInternal<T>`
 * for internal-only branded types). `as never` silently drops type
 * information, defeats type-safety in tests, and breaks brand-aware
 * helpers downstream of the cast.
 *
 * The rule scope is enforced via the per-glob registration in
 * `tooling/eslint-config/index.js` — this rule body fires on every
 * `as never` regardless of file, so the activation glob must restrict
 * to tests.
 *
 * The rule has no allow-list. Exceptions require modifying this file
 * directly, which is reviewed at the same level as a feature change.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid `as never` casts in test files",
    },
    messages: {
      noAsNever:
        "Use `brandId<T>(raw)` from @pluralscape/types (or `tagInternal<T>` for internal-only branded types). `as never` silently drops type information.",
    },
    schema: [],
  },
  create(context) {
    return {
      TSAsExpression(node) {
        if (node.typeAnnotation?.type === "TSNeverKeyword") {
          context.report({ node, messageId: "noAsNever" });
        }
      },
    };
  },
};
