/**
 * Forbid PR or bean ID references in source code and comments.
 *
 * Patterns matched:
 *   PR #123 / PR123 / PR 123
 *   ps-abc1, api-abc1, db-abc1, types-abc1, crypto-abc1, sync-abc1,
 *   client-abc1, mobile-abc1, infra-abc1
 *
 * These references rot at closeout. Move context to a spec/plan file
 * (in docs/superpowers/, gitignored).
 *
 * The rule has no allow-list. Exceptions require modifying this file
 * directly, which is reviewed at the same level as a feature change.
 */
const PR_RE = /\bPR\s*#?\d+\b/i;
const BEAN_RE = /\b(?:ps|api|db|types|crypto|sync|client|mobile|infra)-[a-z0-9]{4}\b/;

function hasRef(text) {
  return PR_RE.test(text) || BEAN_RE.test(text);
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid PR/bean ID references in code and comments",
    },
    messages: {
      noRef:
        "PR/bean references rot at closeout. Drop the reference, or move the context into a spec/plan file under docs/superpowers/.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      Program() {
        for (const c of sourceCode.getAllComments()) {
          if (hasRef(c.value)) {
            context.report({
              loc: c.loc,
              messageId: "noRef",
            });
          }
        }
      },
      Literal(node) {
        if (typeof node.value === "string" && hasRef(node.value)) {
          context.report({ node, messageId: "noRef" });
        }
      },
      TemplateElement(node) {
        if (hasRef(node.value.raw)) {
          context.report({ node, messageId: "noRef" });
        }
      },
    };
  },
};
