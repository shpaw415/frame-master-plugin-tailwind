import { type FrameMasterPlugin } from "frame-master/plugin";
import BunTailwindPlugin from "bun-plugin-tailwind";

export type TailwindPluginProps = {
  inputFile: string;
  outputFile: string;
};

declare global {
  var __BUN_TAILWIND_PLUGIN_CHILD_PROCESS__:
    | Bun.Subprocess<"ignore", "inherit", "inherit">
    | undefined;
}

export default function createPlugin({
  inputFile,
  outputFile,
}: TailwindPluginProps): FrameMasterPlugin {
  const spawn = () => {
    if (globalThis.__BUN_TAILWIND_PLUGIN_CHILD_PROCESS__) return;
    __BUN_TAILWIND_PLUGIN_CHILD_PROCESS__ = Bun.spawn({
      cmd: [
        "bunx",
        "@tailwindcss/cli",
        "-i",
        inputFile,
        "-o",
        outputFile,
        "--watch",
      ],
      stdout: "inherit",
      stderr: "inherit",
    });
  };

  return {
    name: "tailwind-plugin",
    serverStart: {
      dev_main() {
        const subProcess = globalThis.__BUN_TAILWIND_PLUGIN_CHILD_PROCESS__;
        if (!subProcess || subProcess.exitCode !== null) {
          spawn();
        }
      },
    },
  };
}

export const TailwindPlugin = BunTailwindPlugin;
