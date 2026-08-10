/**
 * Integration: Tailwind HMR WebSocket + CSS reload broadcast.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { PUBLIC_WS_PATH } from "../../src/constants";
import {
	OUTPUT_CSS,
	startTailwindEnv,
	waitFor,
	withTailwindFixture,
	writeMinimalTailwindApp,
	wsUrl,
} from "./helpers";

describe("integration: HMR websocket", () => {
	test("ws upgrades on /ws/tailwind", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);
			const env = await startTailwindEnv({ dir });
			setEnv(env);

			expect(env.baseUrl).toBeTruthy();
			const base = env.baseUrl as string;
			const url = wsUrl(base, PUBLIC_WS_PATH);

			const opened = await new Promise<boolean>((resolve, reject) => {
				const ws = new WebSocket(url);
				const timer = setTimeout(() => {
					ws.close();
					reject(new Error("timeout waiting for ws open"));
				}, 10_000);
				ws.addEventListener("open", () => {
					clearTimeout(timer);
					ws.close();
					resolve(true);
				});
				ws.addEventListener("error", () => {
					clearTimeout(timer);
					reject(new Error("ws error on open"));
				});
			});

			expect(opened).toBe(true);
		});
	}, 60_000);

	test("output CSS change broadcasts reload to connected clients", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);
			const env = await startTailwindEnv({ dir });
			setEnv(env);
			// Let hot-file-watcher + tailwind watch settle
			await Bun.sleep(800);

			expect(env.baseUrl).toBeTruthy();
			const base = env.baseUrl as string;
			const url = wsUrl(base, PUBLIC_WS_PATH);
			const outPath = join(dir, OUTPUT_CSS);

			const message = await new Promise<string>((resolve, reject) => {
				const ws = new WebSocket(url);
				const timer = setTimeout(() => {
					ws.close();
					reject(new Error("timeout waiting for reload message"));
				}, 15_000);

				ws.addEventListener("open", async () => {
					const current = await Bun.file(outPath).text();
					await Bun.write(
						outPath,
						`${current}\n/* hmr-ping ${Date.now()} */\n`,
					);
				});

				ws.addEventListener("message", (ev) => {
					clearTimeout(timer);
					resolve(String(ev.data));
					ws.close();
				});

				ws.addEventListener("error", () => {
					clearTimeout(timer);
					reject(new Error("ws error while waiting for reload"));
				});
			});

			expect(message).toBe("reload");
		});
	}, 60_000);

	test("CSS remains fetchable after HMR-style rewrite of output", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);
			const env = await startTailwindEnv({ dir });
			setEnv(env);

			const outPath = join(dir, OUTPUT_CSS);
			const marker = `/* post-hmr-${Date.now()} */`;
			const current = await Bun.file(outPath).text();
			await Bun.write(outPath, `${current}\n${marker}\n`);

			await waitFor(
				async () => {
					const res = await env.fetch("/tailwind.css");
					const body = await res.text();
					return body.includes(marker);
				},
				{ label: "CSS route to pick up rewritten output", timeoutMs: 5_000 },
			);

			const res = await env.fetch("/tailwind.css");
			expect(res.status).toBe(200);
			expect(await res.text()).toContain(marker);
		});
	}, 60_000);
});
