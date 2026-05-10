/**
 * Forbid `Bearer ` prefix in Authorization headers within packages/import-sp.
 * Simply Plural authenticates with the raw API token as the Authorization
 * header value (no prefix, ever).
 *
 * The rule has no allow-list. Exceptions require modifying this file
 * directly, which is reviewed at the same level as a feature change.
 */
const AUTH_KEY_RE = /^(?:authorization|auth|token|api[_-]?key)$/i;

function isBearerLiteral(node) {
  if (!node) return false;
  if (node.type === "Literal" && typeof node.value === "string") {
    return /^Bearer\s/i.test(node.value);
  }
  if (node.type === "TemplateLiteral") {
    const head = node.quasis[0]?.value?.raw ?? "";
    return /^Bearer\s/i.test(head);
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    return isBearerLiteral(node.left);
  }
  return false;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid Bearer prefix in Authorization headers in packages/import-sp",
    },
    messages: {
      noBearer:
        "Simply Plural authenticates with the raw API token as the Authorization header value. Never prepend `Bearer `.",
    },
    schema: [],
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/");
    if (!filename.includes("packages/import-sp/src/")) {
      return {};
    }

    return {
      Property(node) {
        const keyName =
          node.key.type === "Identifier"
            ? node.key.name
            : node.key.type === "Literal"
              ? String(node.key.value)
              : null;
        if (!keyName) return;
        if (!AUTH_KEY_RE.test(keyName)) return;
        if (isBearerLiteral(node.value)) {
          context.report({ node: node.value, messageId: "noBearer" });
        }
      },
    };
  },
};
