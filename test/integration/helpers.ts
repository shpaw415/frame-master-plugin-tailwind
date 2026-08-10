import { symlink } from "node:fs/promises";
import { join } from "node:path";
import type { FrameMasterPlugin } from "frame-master/plugin/types";
import {
	createPluginTestEnv,
	type PluginTestEnv,
	withTempDir,
	writeFixture,
} from "frame-master/testing";
import TailwindPlugin from "../../src/index";
import type { TailwindPluginOptions } from "../../src/types";

export { withTempDir };

export const INPUT_CSS = "static/input.css";
export const OUTPUT_CSS = "static/output.css";

/** Package root (frame-master-plugin-tailwind) — source of peer deps for fixtures. */
export const PACKAGE_ROOT = join(import.meta.dir, "..", "..");

export const MINIMAL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Tailwind DX</title>
</head>
<body>
  <h1 class="text-xl font-bold">Hello Tailwind</h1>
</body>
</html>
`;

/** Companion plugin that serves HTML so html_rewrite can be asserted. */
export function htmlPagePlugin(
	html: string = MINIMAL_HTML,
	pathname = "/",
): FrameMasterPlugin {
	return {
		name: "test-html-page",
		version: "0.0.0",
		router: {
			request(master) {
				if (master.URL.pathname === pathname) {
					master.setResponse(html, {
						status: 200,
						headers: { "Content-Type": "text/html; charset=utf-8" },
					});
				}
			},
		},
	};
}

/**
 * Link host package node_modules into the fixture so Tailwind can resolve
 * `@import "tailwindcss"` the same way a real app would.
 */
export async function linkPackageNodeModules(dir: string): Promise<void> {
	const target = join(PACKAGE_ROOT, "node_modules");
	const linkPath = join(dir, "node_modules");
	try {
		await symlink(target, linkPath, "dir");
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code !== "EEXIST") throw err;
	}
}

export async function writeMinimalTailwindApp(
	dir: string,
	css = '@import "tailwindcss";\n',
): Promise<void> {
	await linkPackageNodeModules(dir);
	await writeFixture(dir, INPUT_CSS, css);
	await writeFixture(dir, "src/index.html", MINIMAL_HTML);
}

export type StartTailwindEnvOptions = {
	dir: string;
	options?: TailwindPluginOptions;
	extraPlugins?: FrameMasterPlugin[];
	startServer?: boolean;
	runServerStart?: boolean;
	runCreateContext?: boolean;
};

/**
 * Boot the Tailwind plugin inside createPluginTestEnv.
 * Caller must chdir to `dir` before calling (plugin resolves paths via cwd).
 */
export async function startTailwindEnv(
	opts: StartTailwindEnvOptions,
): Promise<PluginTestEnv> {
	const {
		dir,
		options,
		extraPlugins = [],
		startServer = true,
		runServerStart = true,
		runCreateContext = true,
	} = opts;

	return createPluginTestEnv({
		cwd: dir,
		startServer,
		runServerStart,
		runCreateContext,
		plugins: [
			...extraPlugins,
			TailwindPlugin({
				inputFile: INPUT_CSS,
				outputFile: OUTPUT_CSS,
				options,
			}),
		],
	});
}

export async function waitFor(
	predicate: () => boolean | Promise<boolean>,
	opts: { timeoutMs?: number; intervalMs?: number; label?: string } = {},
): Promise<void> {
	const timeoutMs = opts.timeoutMs ?? 15_000;
	const intervalMs = opts.intervalMs ?? 100;
	const label = opts.label ?? "condition";
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (await predicate()) return;
		await Bun.sleep(intervalMs);
	}
	throw new Error(`timeout waiting for ${label} (${timeoutMs}ms)`);
}

export function wsUrl(baseUrl: string, path: string): string {
	return baseUrl.replace(/^http/, "ws") + path;
}

/**
 * Stop plugin side-effects (Tailwind watch, file watchers, sockets) then server.
 * createPluginTestEnv.dispose() only stops the HTTP server.
 */
export async function disposeTailwindEnv(
	env: PluginTestEnv | undefined,
): Promise<void> {
	if (!env) return;
	for (const plugin of env.pluginLoader.getPlugins()) {
		const reload = (plugin as { onConfigReload?: () => void | Promise<void> })
			.onConfigReload;
		if (typeof reload === "function") {
			try {
				await reload.call(plugin);
			} catch {
				// best-effort cleanup
			}
		}
	}
	await env.dispose();
}

/**
 * Run a fixture test with cwd isolation and guaranteed env dispose
 * *before* the temp dir is removed (so Tailwind watch can stop cleanly).
 */
export async function withTailwindFixture(
	fn: (ctx: {
		dir: string;
		setEnv: (env: PluginTestEnv) => void;
	}) => Promise<void>,
): Promise<void> {
	await withTempDir(async (dir) => {
		let env: PluginTestEnv | undefined;
		const prev = process.cwd();
		process.chdir(dir);
		try {
			await fn({
				dir,
				setEnv: (e) => {
					env = e;
				},
			});
		} finally {
			await disposeTailwindEnv(env);
			process.chdir(prev);
		}
	});
}
