/**
 * Integration: HTML rewrite injects CSS + bootstrap in dev.
 */
import { describe, expect, test } from "bun:test";
import {
	BOOTSTRAP_SCRIPT_ID,
	CSS_LINK_ID,
	PUBLIC_BOOTSTRAP_PATH,
	PUBLIC_CSS_PATH,
} from "../../src/constants";
import {
	htmlPagePlugin,
	startTailwindEnv,
	withTailwindFixture,
	writeMinimalTailwindApp,
} from "./helpers";

describe("integration: HTML inject (DX)", () => {
	test("autoInjectInHtml injects stylesheet + bootstrap into HTML responses", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);
			const env = await startTailwindEnv({
				dir,
				extraPlugins: [htmlPagePlugin()],
			});
			setEnv(env);

			const res = await env.fetch("/");
			expect(res.status).toBe(200);
			const html = await res.text();

			expect(html).toContain(`id="${CSS_LINK_ID}"`);
			expect(html).toContain(`href="${PUBLIC_CSS_PATH}"`);
			expect(html).toContain(`id="${BOOTSTRAP_SCRIPT_ID}"`);
			expect(html).toContain(`src="${PUBLIC_BOOTSTRAP_PATH}"`);
		});
	}, 60_000);

	test("autoInjectInHtml:false leaves HTML untouched", async () => {
		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);
			const env = await startTailwindEnv({
				dir,
				options: { autoInjectInHtml: false },
				extraPlugins: [htmlPagePlugin()],
			});
			setEnv(env);

			const html = await (await env.fetch("/")).text();
			expect(html).not.toContain(CSS_LINK_ID);
			expect(html).not.toContain(BOOTSTRAP_SCRIPT_ID);
			expect(html).toContain("Hello Tailwind");
		});
	}, 60_000);

	test("dedupes pre-existing tailwind link id on inject", async () => {
		const withDup = `<!DOCTYPE html><html><head>
			<link href="/stale.css" rel="stylesheet" id="${CSS_LINK_ID}">
			<title>t</title>
		</head><body><p>ok</p></body></html>`;

		await withTailwindFixture(async ({ dir, setEnv }) => {
			await writeMinimalTailwindApp(dir);
			const env = await startTailwindEnv({
				dir,
				extraPlugins: [htmlPagePlugin(withDup)],
			});
			setEnv(env);

			const html = await (await env.fetch("/")).text();
			const matches = html.match(new RegExp(`id="${CSS_LINK_ID}"`, "g"));
			expect(matches?.length).toBe(1);
			expect(html).toContain(PUBLIC_CSS_PATH);
			expect(html).not.toContain("/stale.css");
		});
	}, 60_000);
});
