import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Runtime } from "./types";

/**
 * Build the argv for invoking the Tailwind CSS CLI.
 * Prefer a resolved local binary when available; fall back to bunx/npx.
 */
export function buildTailwindCommand(
	runtime: Runtime,
	args: string[],
): string[] {
	const bin = resolveTailwindBinary();
	if (bin) {
		// Local CLI entry is a .mjs module — run via Bun for reliability
		if (bin.endsWith(".mjs") || bin.endsWith(".js")) {
			return ["bun", "run", bin, ...args];
		}
		return [bin, ...args];
	}

	if (runtime === "bun" || runtime === "bunx") {
		return ["bunx", "tailwindcss", ...args];
	}
	return ["npx", "--yes", "tailwindcss", ...args];
}

function resolveTailwindBinary(): string | null {
	const candidates = [
		join(
			process.cwd(),
			"node_modules",
			"@tailwindcss",
			"cli",
			"dist",
			"index.mjs",
		),
		join(
			import.meta.dir,
			"..",
			"node_modules",
			"@tailwindcss",
			"cli",
			"dist",
			"index.mjs",
		),
	];

	for (const path of candidates) {
		if (existsSync(path)) return path;
	}

	return Bun.which("tailwindcss") ?? null;
}
