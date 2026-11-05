const { getDefaultConfig } = require("expo/metro-config");

const NODE_MODULES_SEGMENT = "/node_modules/";
const JS_EXTENSION = ".js";

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build and Automerge's web entry both import .wasm files.
config.resolver.assetExts.push("wasm");

/**
 * Workspace TypeScript imports use ESM `.js` specifiers, which Metro does not
 * map to `.ts` or `.tsx`. Dropping the extension lets Metro try its source
 * extensions, which still include `.js`. Published packages resolve as written.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isRelative = moduleName.startsWith(".");
  const isWorkspaceSource = !context.originModulePath.includes(NODE_MODULES_SEGMENT);
  const target =
    isRelative && isWorkspaceSource && moduleName.endsWith(JS_EXTENSION)
      ? moduleName.slice(0, -JS_EXTENSION.length)
      : moduleName;
  return context.resolveRequest(context, target, platform);
};

module.exports = config;
