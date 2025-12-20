import type { FrameMasterConfig } from "frame-master/server/types";
import TailwindPlugin from "../src";
import { isDev } from "frame-master/utils";

const router = new Bun.FileSystemRouter({
  dir: "src",
  style: "nextjs",
  fileExtensions: [".html"],
});

const routesPathnames = Object.keys(router.routes);

const routes = Object.assign(
  {},
  ...(await Promise.all(
    routesPathnames.map(async (pathname) => {
      const bundle = await import(`./src${pathname}/index.html`);
      return {
        [pathname]: bundle.default,
      };
    })
  ))
);

export default {
  HTTPServer: {
    port: 3001,
    development: isDev(),
    routes,
  },
  plugins: [
    TailwindPlugin({
      inputFile: "static/tailwind.css",
      outputFile: "static/output.css",
      options: {
        autoInjectInBuild: true,
      },
    }),
    {
      name: "html-entrypoints-plugin",
      version: "1.0.0",
      build: {
        buildConfig: {
          entrypoints: Object.values(router.routes),
        },
      },
    },
  ],
} satisfies FrameMasterConfig;
