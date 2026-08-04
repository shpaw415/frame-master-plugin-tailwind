/** Public URL for compiled CSS (served by the plugin route). */
export const PUBLIC_CSS_PATH = "/tailwind.css";

/** Public URL for the HMR bootstrap client. */
export const PUBLIC_BOOTSTRAP_PATH = "/tailwind/bootstrap.js";

/** Bun build virtual module path for the bootstrap client. */
export const BUILD_BOOTSTRAP_ALIAS = "@tailwind/bootstrap.js";

/** WebSocket upgrade path for CSS HMR. */
export const PUBLIC_WS_PATH = "/ws/tailwind";

/** DOM id for the stylesheet link (required for HMR). */
export const CSS_LINK_ID = "__tailwindcss__";

/** DOM id for the HMR bootstrap script. */
export const BOOTSTRAP_SCRIPT_ID = "__tailwind_bootstrap__";
