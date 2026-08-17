/**
 * Integration: failure modes + clean dispose / recover.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createPluginTestEnv, writeFixture } from "frame-master/testing";
import TailwindPlugin from "../../src/index";
import {
	disposeTailwindEnv,
	OUTPUT_CSS,
	startTailwindEnv,
	withTailwindFixture,
	withTempDir,
	writeMinimalTailwindApp,
} from "./helpers";

describe("integration: fail + recover", () => {
	test("missing inputFile fails createContext with clear error", async () => {
		await withTempDir(async (dir) => {
			const prev = process.cwd();
			process.chdir(dir);
			try {
				await expect(
					createPluginTestEnv({
						cwd: dir,
						startServer: false,
						plugins: [
							TailwindPlugin({
								inputFile: "static/missing.css",
								outputFile: "static/out.css",
							}),
						],
					}),
				).rejects.toThrow(/does not exist|inputFile/i);
			} finally {
				process.chdir(prev);
			}
		});
	}, 30_000);

	test("dispose stops server; second env can boot cleanly", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);

			const first = await startTailwindEnv({ dir });
			expect(first.baseUrl).toBeTruthy();
			const res1 = await first.fetch("/tailwind.css");
			expect(res1.status).toBe(200);
			await disposeTailwindEnv(first);

			// Recover: new env on same fixtures
			const second = await startTailwindEnv({ dir });
			setEnv(second);
			expect(second.baseUrl).toBeTruthy();
			const res2 = await second.fetch("/tailwind.css");
			expect(res2.status).toBe(200);
			expect((await res2.text()).length).toBeGreaterThan(0);
		});
	}, 90_000);

	test("empty inputFile rejected at resolveConfig", async () => {
		await withTempDir(async (dir) => {
			await writeFixture(dir, "static/ok.css", '@import "tailwindcss";\n');
			const prev = process.cwd();
			process.chdir(dir);
			try {
				await expect(
					createPluginTestEnv({
						cwd: dir,
						startServer: false,
						plugins: [
							TailwindPlugin({
								inputFile: "   ",
								outputFile: join(dir, OUTPUT_CSS),
							}),
						],
					}),
				).rejects.toThrow(/inputFile/);
			} finally {
				process.chdir(prev);
			}
		});
	}, 30_000);
});
