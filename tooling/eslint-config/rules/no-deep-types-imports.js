/**
 * Forbid deep imports from @pluralscape/types/... that are not declared as
 * package subpath exports. Use the root barrel: import { Member } from
 * "@pluralscape/types".
 *
 * The allow-list mirrors the explicit subpath exports in
 * `packages/types/package.json` (`./runtime`, `./crypto-keys`). These are
 * deliberate non-entity helpers exposed at their own entry point. Anything
 * else — most importantly any `entities/...` deep path — is forbidden.
 *
 * The rule has no per-consumer allow-list. Adding a new allowed subpath
 * means adding it to the package's exports map AND updating this set.
 */
const ALLOWED_SUBPATHS = new Set(["runtime", "crypto-keys"]);

export default {
  meta: {
    type: "problem",
    docs: { description: "Forbid deep imports from @pluralscape/types/..." },
    messages: {
      noDeepImport:
        "Import from `@pluralscape/types` root barrel only. Deep imports break on file reorgs.",
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const src = node.source.value;
        if (typeof src !== "string") return;
        const m = /^@pluralscape\/types\/(.+)$/.exec(src);
        if (!m) return;
        const sub = m[1].replace(/\.js$/, "").split("/")[0];
        if (ALLOWED_SUBPATHS.has(sub)) return;
        context.report({ node, messageId: "noDeepImport" });
      },
    };
  },
};
