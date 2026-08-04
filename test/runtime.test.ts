import { describe, expect, test } from "bun:test";
import { buildTailwindCommand } from "../src/runtime";

describe("buildTailwindCommand", () => {
	test("returns a non-empty argv including input/output flags", () => {
		const cmd = buildTailwindCommand("bun", [
			"-i",
			"in.css",
			"-o",
			"out.css",
			"--minify",
		]);
		expect(cmd.length).toBeGreaterThan(2);
		expect(cmd).toContain("-i");
		expect(cmd).toContain("in.css");
		expect(cmd).toContain("-o");
		expect(cmd).toContain("out.css");
		expect(cmd).toContain("--minify");
	});

	test("npx runtime falls back to npx when no local binary (or still works)", () => {
		const cmd = buildTailwindCommand("npx", ["-i", "a.css", "-o", "b.css"]);
		// Either local bun run path or npx tailwindcss
		expect(
			cmd[0] === "bun" || cmd[0] === "npx" || cmd[0]?.includes("tailwind"),
		).toBe(true);
	});
});
