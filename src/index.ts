import { join } from "node:path";
import type { FrameMasterPlugin } from "frame-master/plugin";
import { createHotFileWatcher } from "frame-master/server/hot-file-watcher";
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

	let fileWatcher: Awaited<ReturnType<typeof createHotFileWatcher>> | null =
		null;
	let tailwindWatcher: TailwindWatcher | null = null;

	async function stopLifecycle(): Promise<void> {
		fileWatcher?.stop();
		fileWatcher = null;
		tailwindWatcher?.stop();
		tailwindWatcher = null;
		clearTailwindSockets();
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

			// Production inject plugin was created with relative path; recompile uses absolute
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

				fileWatcher = await createHotFileWatcher({
					filePath: outputFile,
					onReload() {
						broadcastCssReload();
					},
					debounceDelay: 250,
					name: "tailwind-output-watcher",
				});

				tailwindWatcher = createTailwindWatcher({
					inputFile,
					outputFile,
					runtime,
				});
				tailwindWatcher.start();
			},
		},

		async onConfigReload() {
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

		build: {
			buildConfig: async () => {
				const plugins: Bun.BunPlugin[] = [];
				if (autoInjectInBuild && isProd()) {
					plugins.push(createInjectInBuildPlugin(outputFile));
				}
				if (autoInjectInHtml && isDev()) {
					plugins.push(createInjectBootstrapInBuildPlugin());
				}
				return {
					files: {
						[BUILD_BOOTSTRAP_ALIAS]: await Bun.file(
							join(import.meta.dir, "..", "dist", "bootstrap.js"),
						).text(),
					},
					plugins,
				};
			},
		},
	};
}
