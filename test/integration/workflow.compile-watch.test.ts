/**
 * Integration: compile on boot + selective rebuild via Tailwind --watch.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { writeFixture } from "frame-master/testing";
import { PUBLIC_CSS_PATH } from "../../src/constants";
import {
	INPUT_CSS,
	OUTPUT_CSS,
	startTailwindEnv,
	waitFor,
	withTailwindFixture,
	writeMinimalTailwindApp,
} from "./helpers";

describe("integration: compile + watch rebuild", () => {
	test("boot compiles utilities used in project sources", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(
				dir,
				'@import "tailwindcss";\n@source "./src/**/*.html";\n',
			);
			await writeFixture(
				dir,
				"src/index.html",
				`<!DOCTYPE html><html><body><div class="bg-red-500 text-white p-4">Hi</div></body></html>\n`,
			);

			const env = await startTailwindEnv({ dir });
			setEnv(env);

			const css = await Bun.file(join(dir, OUTPUT_CSS)).text();
			expect(css).toMatch(/\.bg-red-500|bg-red-500/);
			expect(css).toMatch(/\.text-white|text-white/);

			const served = await (await env.fetch(PUBLIC_CSS_PATH)).text();
			expect(served).toMatch(/bg-red-500/);
		});
	}, 90_000);

	test("input CSS change is rebuilt by watch process", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(
				dir,
				'@import "tailwindcss";\n@source "./src/**/*.html";\n',
			);
			await writeFixture(
				dir,
				"src/index.html",
				`<!DOCTYPE html><html><body><p class="text-blue-600">A</p></body></html>\n`,
			);

			const env = await startTailwindEnv({ dir });
			setEnv(env);
			await Bun.sleep(1_000);

			await writeFixture(
				dir,
				"src/index.html",
				`<!DOCTYPE html><html><body><p class="text-blue-600 underline decoration-wavy">B</p></body></html>\n`,
			);
			const inputPath = join(dir, INPUT_CSS);
			const input = await Bun.file(inputPath).text();
			await Bun.write(inputPath, `${input}\n/* rebuild ${Date.now()} */\n`);

			await waitFor(
				async () => {
					const css = await Bun.file(join(dir, OUTPUT_CSS)).text();
					return (
						css.includes("underline") ||
						css.includes("decoration-wavy") ||
						css.includes("text-decoration")
					);
				},
				{
					label: "watch rebuild to emit new utilities",
					timeoutMs: 30_000,
					intervalMs: 250,
				},
			);

			const served = await (await env.fetch(PUBLIC_CSS_PATH)).text();
			expect(served.length).toBeGreaterThan(50);
		});
	}, 90_000);
});
