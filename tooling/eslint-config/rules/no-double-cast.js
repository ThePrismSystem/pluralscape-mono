/**
 * Forbid double type assertions (`as A as B`). Catches `as unknown as T`,
 * `as never as T`, and similar bypasses of the type system.
 *
 * Use a type predicate, generic narrowing, or fix the source type. If the
 * value is genuinely unknown shape, parse it through Zod first.
 *
 * The rule has no allow-list. Exceptions require modifying this file
 * directly, which is reviewed at the same level as a feature change.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid double type assertions (`as ... as ...`)",
    },
    messages: {
      noDoubleCast:
        "Double-cast (`as ... as ...`) bypasses the type system. Use a type predicate, generic narrowing, or fix the source type.",
    },
    schema: [],
  },
  create(context) {
    return {
      TSAsExpression(node) {
        if (node.expression?.type === "TSAsExpression") {
          context.report({ node, messageId: "noDoubleCast" });
        }
      },
    };
  },
};
