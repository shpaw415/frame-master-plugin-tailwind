import { type FrameMasterPlugin } from "frame-master/plugin";
import PackageJson from "./package.json";
import path, { join } from "path";

export type TailwindPluginProps = {
  inputFile: string;
  outputFile: string;
};

declare global {
  var __BUN_TAILWIND_PLUGIN_CHILD_PROCESS__:
    | Bun.Subprocess<"ignore", null, null>
    | undefined;
  var __SOCKETS_TAILWIND__: Bun.ServerWebSocket[];
}

globalThis.__SOCKETS_TAILWIND__ ??= [];

/** This plugin add TailwindCss to your project and  */
export default function createPlugin({
  inputFile,
  outputFile,
}: TailwindPluginProps): FrameMasterPlugin<any> {
  return {
    name: "tailwind-plugin",
    version: PackageJson.version,
    serverStart: {
      dev_main() {
        const spawn = () =>
          Bun.spawn({
            cmd: `bunx @tailwindcss/cli -i ${inputFile} -o ${outputFile} --watch always`.split(
              " "
            ),
            stdout: null,
            stderr: null,
            stdin: "ignore",
            onExit() {
              globalThis.__BUN_TAILWIND_PLUGIN_CHILD_PROCESS__ = spawn();
            },
          });
        globalThis.__BUN_TAILWIND_PLUGIN_CHILD_PROCESS__ ??= spawn();
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
            Bun.file(
              join("node_modules", PackageJson.name, "dist", "bootstrap.js")
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
