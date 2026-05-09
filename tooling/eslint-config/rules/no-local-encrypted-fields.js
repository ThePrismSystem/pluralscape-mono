/**
 * Forbid local declarations of <Entity>Raw / <Entity>EncryptedFields /
 * <Entity>EncryptedInput inside packages/data/src/transforms and
 * packages/sync/src. These shapes must come from @pluralscape/types.
 *
 * The compile-time alias `XEncryptedInput = Pick<X, XEncryptedFields>` lives
 * in the canonical entity file at packages/types/src/entities/<entity>.ts.
 * Local redeclarations drift from the SoT.
 *
 * The rule has no allow-list. Exceptions require modifying this file
 * directly, which is reviewed at the same level as a feature change.
 */
const SCOPED_PATHS = [/packages\/data\/src\/transforms\//, /packages\/sync\/src\//];

const FORBIDDEN_SUFFIX_RE = /^[A-Z][A-Za-z0-9]*(Raw|EncryptedFields|EncryptedInput)$/;

function inScope(filename) {
  const f = filename.replace(/\\/g, "/");
  return SCOPED_PATHS.some((re) => re.test(f));
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid local Raw/EncryptedFields/EncryptedInput type declarations in transforms; import from @pluralscape/types",
    },
    messages: {
      noLocal:
        "`{{name}}` is a hand-rolled encrypted-field shape. Import from @pluralscape/types instead. If missing, add it to packages/types/src/entities/<entity>.ts.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!inScope(filename)) return {};

    function check(node, name) {
      if (FORBIDDEN_SUFFIX_RE.test(name)) {
        context.report({ node, messageId: "noLocal", data: { name } });
      }
    }

    return {
      TSTypeAliasDeclaration(node) {
        check(node, node.id.name);
      },
      TSInterfaceDeclaration(node) {
        check(node, node.id.name);
      },
    };
  },
};
