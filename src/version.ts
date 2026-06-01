import packageJson from "../package.json" with { type: "json" }

/** Sidebar label; kept in sync with package.json "version". */
export const PLUGIN_VERSION = packageJson.version
