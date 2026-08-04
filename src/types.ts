export type Runtime = "bun" | "bunx" | "npx";

export type TailwindPluginOptions = {
	/**
	 * Automatically inject Tailwind CSS into HTML entrypoints during production build.
	 * @default true
	 */
	autoInjectInBuild?: boolean;
	/**
	 * Automatically inject Tailwind CSS (and the dev HMR bootstrap) into HTML responses.
	 * @default true
	 *
	 * When `false`, add your own link (and bootstrap script in dev if you want HMR), e.g.:
	 * ```html
	 * <link href="/tailwind.css" rel="stylesheet" id="__tailwindcss__" />
	 * ```
	 */
	autoInjectInHtml?: boolean;
	/**
	 * How to invoke the Tailwind CLI.
	 * @default "bun"
	 *
	 * Use `"bunx"` or `"npx"` if bare `"bun tailwindcss"` fails on your system.
	 */
	runtime?: Runtime;
};

export type TailwindPluginProps = {
	/** Path to the Tailwind input CSS file (relative to cwd or absolute). */
	inputFile: string;
	/** Path where compiled CSS is written (relative to cwd or absolute). */
	outputFile: string;
	options?: TailwindPluginOptions;
};

export type ResolvedTailwindConfig = {
	inputFile: string;
	outputFile: string;
	autoInjectInBuild: boolean;
	autoInjectInHtml: boolean;
	runtime: Runtime;
};

export type TailwindPluginContext = {
	inputFile: string;
	outputFile: string;
	publicCssPath: string;
	publicBootstrapPath: string;
	publicWsPath: string;
};

export type TailwindWsData = {
	tailwind: true;
};

export function isTailwindWsData(data: unknown): data is TailwindWsData {
	return (
		typeof data === "object" &&
		data !== null &&
		(data as TailwindWsData).tailwind === true
	);
}
