import { basename, dirname, join } from "node:path";
import type { FrameMasterPlugin } from "frame-master/plugin";
import { isDev, isProd } from "frame-master/utils";
import PackageJson from "../package.json";
import {
	createInjectBootstrapInBuildPlugin,
	createInjectInBuildPlugin,
} from "./build-plugins";
import { compile } from "./compile";
import { resolveConfig } from "./config";
import {
	BUILD_BOOTSTRAP_ALIAS,
	PUBLIC_BOOTSTRAP_PATH,
	PUBLIC_CSS_PATH,
	PUBLIC_WS_PATH,
} from "./constants";
import { registerHtmlInject } from "./inject";
import { createRoutes } from "./routes";
import type { TailwindPluginContext, TailwindPluginProps } from "./types";
import { createTailwindWatcher, type TailwindWatcher } from "./watch";
import {
	broadcastCssReload,
	clearTailwindSockets,
	trackTailwindSocket,
	untrackTailwindSocket,
} from "./websocket";

export {
	PUBLIC_BOOTSTRAP_PATH,
	PUBLIC_CSS_PATH,
	PUBLIC_WS_PATH,
} from "./constants";
export {
	buildBootstrapScriptTag,
	buildCssLinkTag,
	injectIntoHtml,
} from "./inject";
export type {
	Runtime,
	TailwindPluginContext,
	TailwindPluginOptions,
	TailwindPluginProps,
} from "./types";

/**
 * Tailwind CSS integration for Frame-Master: compile, serve, optional HTML inject, HMR.
 */
export default function createPlugin(
	props: TailwindPluginProps,
): FrameMasterPlugin {
	const {
		inputFile: inputFileProp,
		outputFile: outputFileProp,
		options = {},
	} = props;

	const autoInjectInBuild = options.autoInjectInBuild ?? true;
	const autoInjectInHtml = options.autoInjectInHtml ?? true;
	const runtime = options.runtime ?? "bun";

	// Resolved on createContext (async path validation)
	let inputFile = inputFileProp;
	let outputFile = outputFileProp;

	let tailwindWatcher: TailwindWatcher | null = null;
	const watchDirs: string[] = [dirname(outputFileProp)];

	async function stopLifecycle(): Promise<void> {
		tailwindWatcher?.stop();
		tailwindWatcher = null;
		clearTailwindSockets();
	}

	function isCompiledCssChange(
		filePath: string,
		projectRootPath?: string,
		absolutePath?: string,
	): boolean {
		const target = basename(outputFile);
		const hits = [filePath, projectRootPath, absolutePath].filter(
			(p): p is string => typeof p === "string" && p.length > 0,
		);
		return hits.some(
			(p) => p === outputFile || p === outputFileProp || basename(p) === target,
		);
	}

	return {
		name: PackageJson.name,
		version: PackageJson.version,
		requirement: {
			frameMasterVersion: PackageJson.peerDependencies["frame-master"],
		},

		async createContext(): Promise<TailwindPluginContext> {
			const resolved = await resolveConfig({
				inputFile: inputFileProp,
				outputFile: outputFileProp,
				options: { autoInjectInBuild, autoInjectInHtml, runtime },
			});
			inputFile = resolved.inputFile;
			outputFile = resolved.outputFile;
			const outDir = dirname(outputFile);
			watchDirs.splice(0, watchDirs.length, outDir);

			compile(inputFile, outputFile, runtime);

			return {
				inputFile,
				outputFile,
				publicCssPath: PUBLIC_CSS_PATH,
				publicBootstrapPath: PUBLIC_BOOTSTRAP_PATH,
				publicWsPath: PUBLIC_WS_PATH,
			};
		},

		serverStart: {
			async dev_main() {
				await stopLifecycle();
				tailwindWatcher = createTailwindWatcher({
					inputFile,
					outputFile,
					runtime,
				});
				tailwindWatcher.start();
			},
		},
		fileSystemWatchDir: watchDirs,
		onFileSystemChange(_eventType, filePath, ...rest: string[]) {
			if (isCompiledCssChange(filePath, ...rest)) {
				broadcastCssReload();
			}
		},

		async serverStop() {
			await stopLifecycle();
		},

		websocket: {
			onOpen(ws) {
				trackTailwindSocket(ws);
			},
			onClose(ws) {
				untrackTailwindSocket(ws);
			},
		},

		serverConfig: {
			routes: createRoutes(() => outputFile),
		},

		...(autoInjectInHtml
			? {
					router: {
						html_rewrite: {
							rewrite(reWriter: HTMLRewriter) {
								registerHtmlInject(reWriter, {
									includeBootstrap: isDev(),
									cssHref: PUBLIC_CSS_PATH,
									// Runtime: public path served by plugin routes
									bootstrapSrc: PUBLIC_BOOTSTRAP_PATH,
								});
							},
						},
					},
				}
			: {}),

		virtualModules: {
			[BUILD_BOOTSTRAP_ALIAS]: {
				contents: () =>
					Bun.file(join(import.meta.dir, "..", "dist", "bootstrap.js")).text(),
				loader: "js",
				injectRuntime: false,
			},
		},

		build: {
			buildConfig: async () => {
				const plugins: Bun.BunPlugin[] = [];
				if (autoInjectInBuild && isProd()) {
					plugins.push(createInjectInBuildPlugin(outputFile));
				}
				if (autoInjectInHtml && isDev()) {
					plugins.push(createInjectBootstrapInBuildPlugin());
				}
				return { plugins };
			},
		},
	};
}
