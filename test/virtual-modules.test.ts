import { afterEach, expect, test } from "bun:test";
import { createPluginTestEnv, type PluginTestEnv } from "frame-master/testing";
import { BUILD_BOOTSTRAP_ALIAS } from "../src/constants";
import TailwindPlugin from "../src/index";

let env: PluginTestEnv | undefined;

afterEach(async () => {
	await env?.dispose();
	env = undefined;
});

test("registers the HMR bootstrap through the v4 virtual-module registry", async () => {
	env = await createPluginTestEnv({
		plugins: [
			TailwindPlugin({
				inputFile: "static/input.css",
				outputFile: "static/output.css",
			}),
		],
		startServer: false,
		runCreateContext: false,
		runServerStart: false,
	});

	const module = env.pluginLoader
		.getVirtualModuleRegistry()
		.getModule(BUILD_BOOTSTRAP_ALIAS);

	expect(module).toBeDefined();
	expect(module?.loader).toBe("js");
	expect(module?.injectRuntime).toBe(false);

	const contents =
		typeof module?.contents === "function"
			? await module.contents()
			: module?.contents;
	expect(typeof contents).toBe("string");
	expect(contents).toContain("/ws/tailwind");
	expect(contents).toContain("__tailwindcss__");
	expect(contents).toContain("reload");
});
