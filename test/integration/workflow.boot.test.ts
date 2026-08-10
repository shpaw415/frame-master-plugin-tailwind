/**
 * Integration: Frame-Master 3.2.1 createPluginTestEnv — plugin boot + context.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { getGlobalPluginContext } from "frame-master/plugin/utils";
import type { TailwindPluginContext } from "../../src/types";
import {
	OUTPUT_CSS,
	startTailwindEnv,
	withTailwindFixture,
	writeMinimalTailwindApp,
} from "./helpers";

describe("integration: tailwind boot + context", () => {
	test("plugin loads in createPluginTestEnv", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);
			const env = await startTailwindEnv({ dir });
			setEnv(env);

			expect(
				env.pluginLoader
					.getPlugins()
					.some((p) => String(p.name).includes("tailwind")),
			).toBe(true);
			expect(env.baseUrl).toBeTruthy();
		});
	}, 60_000);

	test("createContext compiles CSS and exposes public path contract", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);
			const env = await startTailwindEnv({ dir });
			setEnv(env);

			const ctx = getGlobalPluginContext("frame-master-plugin-tailwind") as
				| TailwindPluginContext
				| undefined;

			expect(ctx).toBeDefined();
			expect(ctx?.publicCssPath).toBe("/tailwind.css");
			expect(ctx?.publicBootstrapPath).toBe("/tailwind/bootstrap.js");
			expect(ctx?.publicWsPath).toBe("/ws/tailwind");
			expect(ctx?.inputFile).toContain("input.css");
			expect(ctx?.outputFile).toContain("output.css");

			const out = Bun.file(join(dir, OUTPUT_CSS));
			expect(await out.exists()).toBe(true);
			const css = await out.text();
			expect(css.length).toBeGreaterThan(0);
			expect(css).toMatch(/@layer|tailwind|properties/i);
		});
	}, 60_000);

	test("dev_main starts without crashing (watch lifecycle)", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);
			const env = await startTailwindEnv({ dir, runServerStart: true });
			setEnv(env);
			await Bun.sleep(500);
			expect(env.baseUrl).toBeTruthy();
		});
	}, 60_000);
});
