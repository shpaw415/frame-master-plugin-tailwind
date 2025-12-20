import { type FrameMasterPlugin } from "frame-master/plugin";
import PackageJson from "../package.json";
import { join } from "path";
import { isVerbose, join as joinClient, verboseLog } from "frame-master/utils";
import { exit } from "process";
import { isProd } from "frame-master/utils";
import { createHotFileWatcher } from "frame-master/server/hot-file-watcher";
import chalk from "chalk";

export type TailwindPluginProps = {
  inputFile: string;
  outputFile: string;
  options?: {
    /**
     * Automatically inject Tailwind CSS into HTML files during build
     * @default true
     */
    autoInjectInBuild?: boolean;
    /**
     * Specify the runtime environment for Tailwind CSS processing
     * @default "bun"
     *
     * @info Bun runtime can cause issues on some systems, you can switch to "npx" if you face problems. but make sure you have Node.js installed.
     */
    runtime?: Runtime;
  };
};

type Runtime = "bunx" | "npx";

declare global {
  var __BUN_TAILWIND_PLUGIN_CHILD_PROCESS__:
    | Bun.Subprocess<"ignore", null, "pipe">
    | undefined;
  var __SOCKETS_TAILWIND__: Bun.ServerWebSocket[];
}

globalThis.__SOCKETS_TAILWIND__ ??= [];

const cwd = process.cwd();

async function watch(inputFile: string, outputFile: string, runtime: Runtime) {
  if (globalThis.__BUN_TAILWIND_PLUGIN_CHILD_PROCESS__) return;
  const ErrorOutputHistory: string[] = [];

  const proc = Bun.spawn({
    cmd: [
      runtime,
      "@tailwindcss/cli",
      "-i",
      inputFile,
      "-o",
      outputFile,
      "--watch",
      "always",
    ],
    stdin: "ignore",
    stdout: null,
    stderr: "pipe",
    onExit(_, exitCode) {
      if (exitCode == 0) console.log("Tailwind CSS process exited normally.");
      else {
        console.error("Tailwind CSS process exited with code:", exitCode);
        console.log(
          [
            chalk.cyan("-".repeat(10)),
            ...ErrorOutputHistory.map((line) => chalk.whiteBright(line)),
            chalk.cyan("-".repeat(10)),
          ].join("\n")
        );
        setTimeout(() => {
          console.log("Exiting Frame Master due to Tailwind CSS failure.");
          exit(1);
        }, 1000);
      }
      globalThis.__BUN_TAILWIND_PLUGIN_CHILD_PROCESS__ = undefined;
    },
  });

  globalThis.__BUN_TAILWIND_PLUGIN_CHILD_PROCESS__ = proc;
  const decoder = new TextDecoder();
  for await (const chunk of proc.stderr) {
    const str = decoder.decode(chunk);
    ErrorOutputHistory.push(str);
    if (ErrorOutputHistory.length > 10) ErrorOutputHistory.shift();
    if (!str.includes("Error")) continue;
    console.error("Tailwind CSS Error:", str);
    console.log("Make sure you have tailwindcss installed.");
  }
}

function compile(inputFile: string, outputFile: string, runtime: Runtime) {
  const proc = Bun.spawnSync({
    cmd: [
      runtime,
      "@tailwindcss/cli",
      "-i",
      inputFile,
      "-o",
      outputFile,
      "--minify",
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0) {
    console.error("Failed to compile Tailwind CSS. Exiting.");
    exit(1);
  }
}

/**
 * Plugin to inject Tailwind CSS into HTML files during build
 * NOTE: It won't work until Bun supports multiple file sharing the same output
 **/
const injectInBuildPlugin: (outfile: string) => Bun.BunPlugin = (outfile) => ({
  name: "tailwind-inject-build-plugin",
  setup(build) {
    const rewriter = new HTMLRewriter();
    rewriter
      .on("head", {
        element(element) {
          element.append(
            `<link href="/${joinClient(
              outfile
            )}" rel="stylesheet" id="__tailwindcss__">`,
            {
              html: true,
            }
          );
        },
      })
      .on("#__tailwindcss__", {
        element(element) {
          // Remove any existing Tailwind CSS link to avoid duplicates
          element.remove();
        },
      });
    build.onEnd(async ({ outputs }) => {
      verboseLog("Injecting Tailwind CSS into HTML files in build...");
      const awaitedOutputs = await Promise.all(
        outputs
          .filter(
            (out) => out.path.endsWith(".html") && out.kind == "entry-point"
          )

          .map(async (out) =>
            Bun.write(
              out.path,
              rewriter.transform(await Bun.file(out.path).arrayBuffer())
            ).then(() => out)
          )
      );
      if (isVerbose()) {
        console.log("-".repeat(20));
        console.log(chalk.yellowBright("[Tailwind Plugin]"));
        awaitedOutputs.forEach((out) => {
          console.log(
            [
              chalk.greenBright(">"),
              chalk.whiteBright("Injected Tailwind CSS into"),
              chalk.cyan(`\`${out.path}\``),
            ].join(" ")
          );
        });
        console.log("-".repeat(20));
      }
      // Copy the output CSS file to the build directory
      const newOutFilePath = join(cwd, build.config.outdir!, outfile);
      const absOutfile = Bun.file(join(cwd, outfile));
      const newOutFile = Bun.file(newOutFilePath);
      await Bun.write(newOutFile, absOutfile, {
        createPath: true,
      });
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

    const removeTailwindLinks = new HTMLRewriter().on("link#__tailwindcss__", {
      element(element) {
        element.remove();
      },
    });

    build.finally("html", (params) => {
      if (!params.contents || typeof params.contents !== "string")
        return {
          contents: params.contents,
        };
      return {
        contents: removeTailwindLinks.transform(params.contents),
      };
    });
  },
});

/**
 * This plugin add TailwindCss to your project.
 * @param inputFile - The input Tailwind CSS file path
 * @param outputFile - The output CSS file path
 * @param options - Additional options for the plugin
 * @returns FrameMasterPlugin
 *
 * @feature Injects Tailwind CSS into HTML files during development and optionally during build
 * @feature Automatically watches and compiles Tailwind CSS files during development
 *
 * @note Make sure to put id="__tailwindcss__" on the link tag for Tailwind CSS.
 **/
export default function createPlugin({
  inputFile,
  outputFile,
  options = {},
}: TailwindPluginProps): FrameMasterPlugin<any> {
  const { autoInjectInBuild = true, runtime = "bunx" } = options;

  return {
    name: PackageJson.name,
    version: PackageJson.version,
    requirement: {
      frameMasterVersion: PackageJson.peerDependencies["frame-master"],
    },
    createContext() {
      return compile(inputFile, outputFile, runtime);
    },
    serverStart: {
      async dev_main() {
        createHotFileWatcher({
          filePath: outputFile,
          onReload() {
            globalThis.__SOCKETS_TAILWIND__
              .filter(
                (w) => (w?.data as unknown as { tailwind?: boolean })?.tailwind
              )
              .forEach((ws) => ws.send("reload"));
          },
          debounceDelay: 250,
          name: "tailwind-output-watcher",
        });
        watch(inputFile, outputFile, runtime);
      },
    },
    websocket: {
      onOpen(ws) {
        globalThis.__SOCKETS_TAILWIND__.push(ws);
      },
      onClose(ws) {
        globalThis.__SOCKETS_TAILWIND__ =
          globalThis.__SOCKETS_TAILWIND__.filter((socket) => socket !== ws);
      },
    },
    serverConfig: {
      routes: {
        ...(process.env.NODE_ENV != "production" && {
          "/ws/tailwind": (req, server) => {
            const success = server.upgrade(req, {
              data: {
                tailwind: true,
              } as any,
            });
            return new Response(
              success ? "welcome to tailwind ws" : undefined,
              {
                status: success ? 101 : 400,
              }
            );
          },
        }),
        "/tailwind/bootstrap.js": (req) =>
          new Response(
            Bun.file(
              join(import.meta.dir, "..", "dist", "bootstrap.js")
            ).stream(),
            {
              headers: {
                "Content-Type": "application/javascript",
              },
            }
          ),
      },
    },
    router: {
      html_rewrite: {
        rewrite(reWriter) {
          reWriter
            .on("head", {
              element(element) {
                element.append(
                  `<link href="/${outputFile}" rel="stylesheet" id="__tailwindcss__">`,
                  {
                    html: true,
                  }
                );
                if (process.env.NODE_ENV != "production")
                  element.append(
                    `<script src="/tailwind/bootstrap.js"></script>`,
                    {
                      html: true,
                    }
                  );
              },
            })
            .on("#__tailwindcss__", {
              element(element) {
                // Remove any existing Tailwind CSS link to avoid duplicates
                element.remove();
              },
            });
        },
      },
    },
    build: {
      buildConfig: {
        plugins:
          autoInjectInBuild && isProd()
            ? [injectInBuildPlugin(outputFile)]
            : [],
      },
    },
  };
}
