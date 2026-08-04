import chalk from "chalk";
import { buildTailwindCommand } from "./runtime";
import type { Runtime } from "./types";

export class TailwindCompileError extends Error {
	constructor(
		message: string,
		readonly exitCode: number | null,
	) {
		super(message);
		this.name = "TailwindCompileError";
	}
}

/**
 * One-shot production compile (minified). Throws on failure instead of process.exit.
 */
export function compile(
	inputFile: string,
	outputFile: string,
	runtime: Runtime,
): void {
	const cmd = buildTailwindCommand(runtime, [
		"-i",
		inputFile,
		"-o",
		outputFile,
		"--minify",
	]);

	const proc = Bun.spawnSync({
		cmd,
		stdout: "inherit",
		stderr: "inherit",
	});

	if (proc.exitCode !== 0) {
		throw new TailwindCompileError(
			[
				chalk.red(
					"[frame-master-plugin-tailwind] Failed to compile Tailwind CSS.",
				),
				chalk.white(`Command: ${cmd.join(" ")}`),
				chalk.white(
					"Ensure `tailwindcss` / `@tailwindcss/cli` is installed in the project.",
				),
			].join("\n"),
			proc.exitCode,
		);
	}
}
