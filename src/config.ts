import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import type {
	ResolvedTailwindConfig,
	Runtime,
	TailwindPluginProps,
} from "./types";

function resolvePath(path: string, cwd: string): string {
	const trimmed = path.trim();
	if (!trimmed) {
		throw new Error("Path must be a non-empty string");
	}
	return isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed);
}

export async function resolveConfig(
	props: TailwindPluginProps,
	cwd: string = process.cwd(),
): Promise<ResolvedTailwindConfig> {
	const { inputFile, outputFile, options = {} } = props;

	if (typeof inputFile !== "string" || !inputFile.trim()) {
		throw new Error(
			"[frame-master-plugin-tailwind] `inputFile` is required and must be a non-empty string",
		);
	}
	if (typeof outputFile !== "string" || !outputFile.trim()) {
		throw new Error(
			"[frame-master-plugin-tailwind] `outputFile` is required and must be a non-empty string",
		);
	}

	const resolvedInput = resolvePath(inputFile, cwd);
	const resolvedOutput = resolvePath(outputFile, cwd);

	const input = Bun.file(resolvedInput);
	if (!(await input.exists())) {
		throw new Error(
			`[frame-master-plugin-tailwind] inputFile does not exist: ${resolvedInput}`,
		);
	}

	const runtime: Runtime = options.runtime ?? "bun";
	if (runtime !== "bun" && runtime !== "bunx" && runtime !== "npx") {
		throw new Error(
			`[frame-master-plugin-tailwind] Invalid runtime "${String(runtime)}". Use "bun", "bunx", or "npx".`,
		);
	}

	await mkdir(dirname(resolvedOutput), { recursive: true });

	return {
		inputFile: resolvedInput,
		outputFile: resolvedOutput,
		autoInjectInBuild: options.autoInjectInBuild ?? true,
		autoInjectInHtml: options.autoInjectInHtml ?? true,
		runtime,
	};
}
