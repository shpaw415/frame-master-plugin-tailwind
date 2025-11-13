import { type FrameMasterPlugin } from "frame-master/plugin";
import PackageJson from "./package.json";
import path, { join } from "path";
import { exit } from "process";

export type TailwindPluginProps = {
  inputFile: string;
  outputFile: string;
};

declare global {
  var __BUN_TAILWIND_PLUGIN_CHILD_PROCESS__:
    | Bun.Subprocess<"ignore", null, "pipe">
    | undefined;
  var __SOCKETS_TAILWIND__: Bun.ServerWebSocket[];
}

globalThis.__SOCKETS_TAILWIND__ ??= [];

async function spawn(inputFile: string, outputFile: string) {
  const proc = Bun.spawn({
    cmd:
      process.env.NODE_ENV == "production"
        ? [
            "bunx",
            "--bun",
            "@tailwindcss/cli",
            "-i",
            inputFile,
            "-o",
            outputFile,
            "--minify",
          ]
        : [
            "bunx",
            "--bun",
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
    onExit(proc, exitCode) {
      if (exitCode == 0)
        return console.log("Tailwind CSS process exited normally.");
      console.error("Tailwind CSS process exited with code:", exitCode);
      setTimeout(() => {
        console.log("Exiting Frame Master due to Tailwind CSS failure.");
        exit(1);
      }, 1000);
    },
  });
  globalThis.__BUN_TAILWIND_PLUGIN_CHILD_PROCESS__ = proc;
  const decoder = new TextDecoder();
  for await (const chunk of proc.stderr) {
    const str = decoder.decode(chunk);
    if (!str.includes("Error")) continue;
    console.error("Tailwind CSS Error:", str);
    console.log("Make sure you have tailwindcss installed.");
  }
}
/** This plugin add TailwindCss to your project and  */
export default function createPlugin({
  inputFile,
  outputFile,
}: TailwindPluginProps): FrameMasterPlugin<any> {
  return {
    name: "tailwind-plugin",
    version: PackageJson.version,
    serverStart: {
      main() {
        spawn(inputFile, outputFile);
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
        "/tailwind.css": (req) =>
          new Response(Bun.file(outputFile), {
            headers: {
              "Content-Type": "text/css",
            },
          }),
        "/tailwind/bootstrap.js": (req) =>
          new Response(
            Bun.file(join(import.meta.dir, "dist", "bootstrap.js")).stream(),
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
          reWriter.on("head", {
            element(element) {
              element.append(
                `<link href="/tailwind.css" rel="stylesheet" id="__tailwindcss__">`,
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
          });
        },
      },
    },
    onFileSystemChange(eventType, filePath, absolutePath) {
      if (absolutePath != outputFile) return;
      globalThis.__SOCKETS_TAILWIND__
        .filter((w) => (w?.data as unknown as { tailwind?: boolean })?.tailwind)
        .forEach((ws) => ws.send("reload"));
    },
    fileSystemWatchDir: [join(...outputFile.split(path.sep).slice(0, -1))],
  };
}
