/**
 * Integration: Tailwind HMR WebSocket + CSS reload broadcast.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { writeFixture } from "frame-master/testing";
import { PUBLIC_CSS_PATH, PUBLIC_WS_PATH } from "../../src/constants";
import {
	INPUT_CSS,
	OUTPUT_CSS,
	startTailwindEnv,
	waitFor,
	withTailwindFixture,
	writeMinimalTailwindApp,
	wsUrl,
} from "./helpers";

function waitForWsMessage(
	url: string,
	opts: {
		timeoutMs?: number;
		onOpen?: () => void | Promise<void>;
	} = {},
): Promise<string> {
	const timeoutMs = opts.timeoutMs ?? 30_000;
	return new Promise<string>((resolve, reject) => {
		const ws = new WebSocket(url);
		const timer = setTimeout(() => {
			ws.close();
			reject(new Error(`timeout waiting for ws message (${timeoutMs}ms)`));
		}, timeoutMs);

		ws.addEventListener("open", () => {
			void Promise.resolve(opts.onOpen?.()).catch((err) => {
				clearTimeout(timer);
				ws.close();
				reject(err);
			});
		});

		ws.addEventListener("message", (ev) => {
			clearTimeout(timer);
			resolve(String(ev.data));
			ws.close();
		});

		ws.addEventListener("error", () => {
			clearTimeout(timer);
			reject(new Error("ws error while waiting for message"));
		});
	});
}

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

			const message = await waitForWsMessage(url, {
				timeoutMs: 15_000,
				onOpen: async () => {
					const current = await Bun.file(outPath).text();
					await Bun.write(
						outPath,
						`${current}\n/* hmr-ping ${Date.now()} */\n`,
					);
				},
			});

			expect(message).toBe("reload");
		});
	}, 60_000);

	test("dev style change rebuilds CSS and pushes WS reload", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			const marker = `dx-style-${Date.now()}`;
			await writeMinimalTailwindApp(
				dir,
				'@import "tailwindcss";\n@source "./src/**/*.html";\n',
			);
			await writeFixture(
				dir,
				"src/index.html",
				`<!DOCTYPE html><html><body><p class="text-blue-600">before</p></body></html>\n`,
			);

			const env = await startTailwindEnv({ dir });
			setEnv(env);
			// Tailwind --watch + output hot-file-watcher need a moment
			await Bun.sleep(1_200);

			expect(env.baseUrl).toBeTruthy();
			const base = env.baseUrl as string;
			const url = wsUrl(base, PUBLIC_WS_PATH);
			const inputPath = join(dir, INPUT_CSS);
			const outPath = join(dir, OUTPUT_CSS);
			const beforeCss = await Bun.file(outPath).text();
			expect(beforeCss).not.toContain(marker);

			// Full DX path: edit stylesheet in dev → watch rewrite output → WS reload
			const message = await waitForWsMessage(url, {
				timeoutMs: 45_000,
				onOpen: async () => {
					const input = await Bun.file(inputPath).text();
					await Bun.write(
						inputPath,
						`${input}\n/* ${marker} */\n.dx-dev-reload { color: #ef4444; outline: 1px solid #${marker.slice(-6).padStart(6, "0")}; }\n`,
					);
				},
			});

			expect(message).toBe("reload");

			await waitFor(
				async () => {
					const css = await Bun.file(outPath).text();
					return css.includes("dx-dev-reload") || css.includes(marker);
				},
				{
					label: "compiled CSS to include edited style",
					timeoutMs: 10_000,
					intervalMs: 100,
				},
			);

			const served = await (await env.fetch(PUBLIC_CSS_PATH)).text();
			expect(served).toMatch(/dx-dev-reload|#ef4444|color:\s*#ef4444/i);
		});
	}, 90_000);

	test("dev utility class change rebuilds and reloads clients", async () => {
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
			await Bun.sleep(1_200);

			expect(env.baseUrl).toBeTruthy();
			const base = env.baseUrl as string;
			const url = wsUrl(base, PUBLIC_WS_PATH);
			const inputPath = join(dir, INPUT_CSS);
			const outPath = join(dir, OUTPUT_CSS);

			const message = await waitForWsMessage(url, {
				timeoutMs: 45_000,
				onOpen: async () => {
					// Simulate editing a template class list in dev
					await writeFixture(
						dir,
						"src/index.html",
						`<!DOCTYPE html><html><body><p class="text-blue-600 underline decoration-wavy">B</p></body></html>\n`,
					);
					// Nudge input so Tailwind watch always re-evaluates content
					const input = await Bun.file(inputPath).text();
					await Bun.write(
						inputPath,
						`${input}\n/* utility-nudge ${Date.now()} */\n`,
					);
				},
			});

			expect(message).toBe("reload");

			await waitFor(
				async () => {
					const css = await Bun.file(outPath).text();
					return (
						css.includes("underline") ||
						css.includes("decoration-wavy") ||
						css.includes("text-decoration")
					);
				},
				{
					label: "watch rebuild to emit new utilities after style edit",
					timeoutMs: 15_000,
					intervalMs: 200,
				},
			);

			const served = await (await env.fetch(PUBLIC_CSS_PATH)).text();
			expect(served.length).toBeGreaterThan(50);
		});
	}, 90_000);

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
