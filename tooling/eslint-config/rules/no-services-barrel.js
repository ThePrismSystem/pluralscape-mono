/**
 * Forbid `index.ts` files inside `apps/api/src/services/<domain>/` directories.
 * Services follow a per-verb-file layout — no barrels.
 *
 * Rationale: the per-verb-file layout (Option E) requires callers to import
 * directly from the specific verb file (e.g., `services/member/create.js`),
 * not from a re-exporting barrel. This codifies the rule that has been
 * documented in the project CLAUDE.md but not mechanically enforced.
 *
 * The rule fires only on `index.ts` files at least one level below
 * `apps/api/src/services/` — a hypothetical top-level
 * `apps/api/src/services/index.ts` is intentionally not flagged (it is not a
 * per-domain barrel).
 *
 * The rule has no allow-list. Exceptions require modifying this file
 * directly, which is reviewed at the same level as a feature change.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid index.ts files inside apps/api/src/services subdirectories",
    },
    messages: {
      noBarrel:
        "apps/api/src/services/<domain>/index.ts is forbidden. Callers import directly from verb files (e.g., services/member/create.ts).",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const normalized = filename.replace(/\\/g, "/");
    const match = /apps\/api\/src\/services\/[^/]+(?:\/[^/]+)*\/index\.ts$/.exec(normalized);

    return {
      Program(node) {
        if (match) {
          context.report({ node, messageId: "noBarrel" });
        }
      },
    };
  },
};
