import {
	BOOTSTRAP_SCRIPT_ID,
	CSS_LINK_ID,
	PUBLIC_BOOTSTRAP_PATH,
	PUBLIC_CSS_PATH,
} from "./constants";

export function buildCssLinkTag(
	href: string = PUBLIC_CSS_PATH,
	id: string = CSS_LINK_ID,
): string {
	return `<link href="${href}" rel="stylesheet" id="${id}">`;
}

export function buildBootstrapScriptTag(
	src: string = PUBLIC_BOOTSTRAP_PATH,
	id: string = BOOTSTRAP_SCRIPT_ID,
): string {
	return `<script src="${src}" id="${id}"></script>`;
}

/**
 * Register rewrite handlers that:
 * 1. Remove any existing Tailwind link/bootstrap script (dedupe)
 * 2. Append a single stylesheet (+ optional bootstrap) into <head>
 *
 * Remove handlers run on existing nodes; append happens on head so new nodes
 * are not re-processed as removals in typical HTMLRewriter implementations.
 * We still remove by id first so user-authored duplicates are cleaned up.
 */
export function registerHtmlInject(
	rewriter: HTMLRewriter,
	opts: {
		includeBootstrap: boolean;
		cssHref?: string;
		bootstrapSrc?: string;
	},
): HTMLRewriter {
	const cssHref = opts.cssHref ?? PUBLIC_CSS_PATH;
	const bootstrapSrc = opts.bootstrapSrc ?? PUBLIC_BOOTSTRAP_PATH;

	return rewriter
		.on(`#${CSS_LINK_ID}`, {
			element(element) {
				element.remove();
			},
		})
		.on(`#${BOOTSTRAP_SCRIPT_ID}`, {
			element(element) {
				element.remove();
			},
		})
		.on("head", {
			element(element) {
				element.append(buildCssLinkTag(cssHref), { html: true });
				if (opts.includeBootstrap) {
					element.append(buildBootstrapScriptTag(bootstrapSrc), {
						html: true,
					});
				}
			},
		});
}

/**
 * Transform an HTML string by injecting (or re-injecting) Tailwind assets.
 * Useful for unit tests and one-shot transforms.
 */
export function injectIntoHtml(
	html: string,
	opts: {
		includeBootstrap: boolean;
		cssHref?: string;
		bootstrapSrc?: string;
	},
): string {
	const rewriter = registerHtmlInject(new HTMLRewriter(), opts);
	return rewriter.transform(html);
}
