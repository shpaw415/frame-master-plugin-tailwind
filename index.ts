import { type FrameMasterPlugin } from "frame-master/plugin";
import BunTailwindPlugin from "bun-plugin-tailwind";

export default function createPlugin(): FrameMasterPlugin {
  return {
    name: "tailwind-plugin",
    runtimePlugins: [BunTailwindPlugin],
  };
}
