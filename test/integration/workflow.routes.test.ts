/**
 * Integration: public URL contract — CSS + bootstrap routes.
 */
import { describe, expect, test } from "bun:test";
import { PUBLIC_BOOTSTRAP_PATH, PUBLIC_CSS_PATH } from "../../src/constants";
import {
	startTailwindEnv,
	withTailwindFixture,
	writeMinimalTailwindApp,
} from "./helpers";

describe("integration: public routes", () => {
	test("GET /tailwind.css serves compiled CSS with dev cache headers", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);
			const env = await startTailwindEnv({ dir });
			setEnv(env);

			const res = await env.fetch(PUBLIC_CSS_PATH);
			expect(res.status).toBe(200);
			expect(res.headers.get("Content-Type")).toMatch(/text\/css/);
			expect(res.headers.get("Cache-Control")).toMatch(/no-store/);

			const body = await res.text();
			expect(body.length).toBeGreaterThan(50);
		});
	}, 60_000);

	test("GET /tailwind/bootstrap.js serves HMR client", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);
			const env = await startTailwindEnv({ dir });
			setEnv(env);

			const res = await env.fetch(PUBLIC_BOOTSTRAP_PATH);
			expect(res.status).toBe(200);
			expect(res.headers.get("Content-Type")).toMatch(/javascript|ecmascript/);

			const body = await res.text();
			expect(body).toContain("/ws/tailwind");
			expect(body).toContain("__tailwindcss__");
			expect(body).toContain("reload");
		});
	}, 60_000);

	test("CSS route reflects on-disk output after createContext compile", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(
				dir,
				'@import "tailwindcss";\n/* marker-dx-route */\n',
			);
			const env = await startTailwindEnv({ dir });
			setEnv(env);

			const res = await env.fetch(PUBLIC_CSS_PATH);
			const body = await res.text();
			expect(body).toMatch(/@layer|@property|--tw|tailwind/i);
		});
	}, 60_000);
});
