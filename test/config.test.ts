import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveConfig } from "../src/config";

const FIXTURE = join(import.meta.dir, ".fixtures-config");

beforeAll(async () => {
	await rm(FIXTURE, { recursive: true, force: true });
	await mkdir(join(FIXTURE, "static"), { recursive: true });
	await writeFile(
		join(FIXTURE, "static", "in.css"),
		'@import "tailwindcss";\n',
	);
});

afterAll(async () => {
	await rm(FIXTURE, { recursive: true, force: true });
});

describe("resolveConfig", () => {
	test("resolves relative paths and defaults", async () => {
		const cfg = await resolveConfig(
			{
				inputFile: "static/in.css",
				outputFile: "static/out.css",
			},
			FIXTURE,
		);
		expect(cfg.inputFile).toBe(join(FIXTURE, "static", "in.css"));
		expect(cfg.outputFile).toBe(join(FIXTURE, "static", "out.css"));
		expect(cfg.autoInjectInBuild).toBe(true);
		expect(cfg.autoInjectInHtml).toBe(true);
		expect(cfg.runtime).toBe("bun");
	});

	test("honors inject option overrides", async () => {
		const cfg = await resolveConfig(
			{
				inputFile: "static/in.css",
				outputFile: "static/out.css",
				options: {
					autoInjectInBuild: false,
					autoInjectInHtml: false,
					runtime: "npx",
				},
			},
			FIXTURE,
		);
		expect(cfg.autoInjectInBuild).toBe(false);
		expect(cfg.autoInjectInHtml).toBe(false);
		expect(cfg.runtime).toBe("npx");
	});

	test("throws when input is missing", async () => {
		await expect(
			resolveConfig({ inputFile: "nope.css", outputFile: "out.css" }, FIXTURE),
		).rejects.toThrow(/does not exist/);
	});

	test("throws on empty inputFile", async () => {
		await expect(
			resolveConfig({ inputFile: "  ", outputFile: "out.css" }, FIXTURE),
		).rejects.toThrow(/inputFile/);
	});
});
