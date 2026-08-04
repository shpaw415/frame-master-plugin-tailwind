import { basename, join } from "node:path";
import chalk from "chalk";
import { isVerbose, verboseLog } from "frame-master/utils";
import {
	BOOTSTRAP_SCRIPT_ID,
	BUILD_BOOTSTRAP_ALIAS,
	PUBLIC_CSS_PATH,
} from "./constants";
import { buildBootstrapScriptTag, injectIntoHtml } from "./inject";

/**
 * Production build: inject CSS link into HTML entrypoints and copy compiled CSS
 * into the outdir as `tailwind.css` so PUBLIC_CSS_PATH resolves.
 */
export function createInjectInBuildPlugin(outputFile: string): Bun.BunPlugin {
	const cwd = process.cwd();

	return {
		name: "tailwind-inject-build-plugin",
		setup(build) {
			// Strip any prior injected link during HTML finalize so onEnd is clean
			build.finally("html", (params) => {
				if (!params.contents || typeof params.contents !== "string") {
					return { contents: params.contents };
				}
				const stripped = new HTMLRewriter()
					.on("#__tailwindcss__", {
						element(el) {
							el.remove();
						},
					})
					.transform(params.contents);
				return { contents: stripped };
			});

			build.onEnd(async ({ outputs }) => {
				verboseLog("Injecting Tailwind CSS into HTML files in build...");
				const htmlOutputs = outputs.filter(
					(out) => out.path.endsWith(".html") && out.kind === "entry-point",
				);

				const awaitedOutputs = await Promise.all(
					htmlOutputs.map(async (out) => {
						const raw = await Bun.file(out.path).text();
						const next = injectIntoHtml(raw, {
							includeBootstrap: false,
							cssHref: PUBLIC_CSS_PATH,
						});
						await Bun.write(out.path, next);
						return out;
					}),
				);

				if (isVerbose()) {
					console.log("-".repeat(20));
					console.log(chalk.yellowBright("[Tailwind Plugin]"));
					for (const out of awaitedOutputs) {
						console.log(
							[
								chalk.greenBright(">"),
								chalk.whiteBright("Injected Tailwind CSS into"),
								chalk.cyan(`\`${out.path}\``),
							].join(" "),
						);
					}
					console.log("-".repeat(20));
				}

				// Copy compiled CSS into outdir as public name
				const outdir = build.config.outdir as string;
				const publicName = basename(PUBLIC_CSS_PATH);
				const newOutFilePath = join(cwd, outdir, publicName);
				const absOutfile = Bun.file(outputFile);
				const newOutFile = Bun.file(newOutFilePath);
				await Bun.write(newOutFile, absOutfile, { createPath: true });
				outputs.push({
					...newOutFile,
					kind: "asset",
					hash: "",
					path: newOutFilePath,
					loader: "css",
					sourcemap: null,
					size: newOutFile.size,
				});
			});
		},
	};
}

/**
 * Dev / non-prod build: inject HMR bootstrap script into HTML.
 * Uses the build virtual alias so Bun resolves the inlined file map entry.
 */
export function createInjectBootstrapInBuildPlugin(): Bun.BunPlugin {
	return {
		name: "inject-bootstrap-in-html",
		setup(build) {
			build.finally("html", ({ contents }) => {
				if (!contents || typeof contents !== "string") {
					return { contents };
				}
				const rewriter = new HTMLRewriter()
					.on(`#${BOOTSTRAP_SCRIPT_ID}`, {
						element(element) {
							element.remove();
						},
					})
					.on("head", {
						element(element) {
							element.append(buildBootstrapScriptTag(BUILD_BOOTSTRAP_ALIAS), {
								html: true,
							});
						},
					});
				return {
					contents: rewriter.transform(contents),
				};
			});
		},
	};
}
