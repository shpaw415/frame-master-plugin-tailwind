import chalk from "chalk";
import { buildTailwindCommand } from "./runtime";
import type { Runtime } from "./types";

const MAX_RESTARTS = 8;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 15_000;

export type TailwindWatcher = {
	start(): void;
	stop(): void;
	readonly running: boolean;
};

/**
 * Long-lived Tailwind CLI `--watch` process with restart-on-crash backoff.
 * Does not call process.exit — failures are logged and retried.
 */
export function createTailwindWatcher(opts: {
	inputFile: string;
	outputFile: string;
	runtime: Runtime;
}): TailwindWatcher {
	let proc: Bun.Subprocess<"ignore", "ignore", "pipe"> | null = null;
	let stopped = false;
	let restarts = 0;
	let restartTimer: ReturnType<typeof setTimeout> | null = null;
	let stderrTask: Promise<void> | null = null;

	const errorHistory: string[] = [];

	function spawnOnce(): void {
		if (stopped) return;

		const cmd = buildTailwindCommand(opts.runtime, [
			"-i",
			opts.inputFile,
			"-o",
			opts.outputFile,
			"--watch",
			"always",
		]);

		const child = Bun.spawn({
			cmd,
			stdin: "ignore",
			stdout: "ignore",
			stderr: "pipe",
			onExit(_, exitCode) {
				if (proc === child) proc = null;
				if (stopped) return;

				if (exitCode === 0) {
					console.log(
						chalk.gray(
							"[frame-master-plugin-tailwind] Tailwind CSS process exited normally.",
						),
					);
					return;
				}

				console.error(
					chalk.red(
						`[frame-master-plugin-tailwind] Tailwind CSS process exited with code ${exitCode}`,
					),
				);
				if (errorHistory.length > 0) {
					console.log(
						[
							chalk.cyan("-".repeat(10)),
							...errorHistory.map((line) => chalk.whiteBright(line)),
							chalk.cyan("-".repeat(10)),
						].join("\n"),
					);
				}

				if (restarts >= MAX_RESTARTS) {
					console.error(
						chalk.red(
							`[frame-master-plugin-tailwind] Gave up restarting after ${MAX_RESTARTS} attempts. Fix Tailwind and restart the dev server.`,
						),
					);
					return;
				}

				const delay = Math.min(BASE_DELAY_MS * 2 ** restarts, MAX_DELAY_MS);
				restarts += 1;
				console.log(
					chalk.yellow(
						`[frame-master-plugin-tailwind] Restarting Tailwind watch in ${delay}ms (attempt ${restarts}/${MAX_RESTARTS})…`,
					),
				);
				restartTimer = setTimeout(() => {
					restartTimer = null;
					spawnOnce();
				}, delay);
			},
		});

		proc = child;
		stderrTask = drainStderr(child);
	}

	async function drainStderr(
		child: Bun.Subprocess<"ignore", "ignore", "pipe">,
	): Promise<void> {
		if (!child.stderr) return;
		const decoder = new TextDecoder();
		try {
			for await (const chunk of child.stderr) {
				const str = decoder.decode(chunk);
				errorHistory.push(str);
				if (errorHistory.length > 20) errorHistory.shift();

				const lower = str.toLowerCase();
				if (
					lower.includes("error") ||
					lower.includes("failed") ||
					lower.includes("cannot")
				) {
					console.error(
						chalk.red("[frame-master-plugin-tailwind] Tailwind CSS:"),
						str.trim(),
					);
				}
			}
		} catch {
			// process closed
		}
	}

	return {
		get running() {
			return proc !== null && !stopped;
		},
		start() {
			if (proc || stopped) return;
			stopped = false;
			restarts = 0;
			spawnOnce();
		},
		stop() {
			stopped = true;
			if (restartTimer) {
				clearTimeout(restartTimer);
				restartTimer = null;
			}
			if (proc) {
				try {
					proc.kill();
				} catch {
					// ignore
				}
				proc = null;
			}
			void stderrTask;
		},
	};
}
