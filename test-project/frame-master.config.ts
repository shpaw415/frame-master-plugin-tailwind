import type { FrameMasterConfig } from "frame-master/server/types";
import TailwindPlugin from "..";
import { isDev } from "frame-master/utils";
import { cpSync } from "fs";

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
    port: 3000,
    development: isDev(),
    routes,
  },
  plugins: [
    TailwindPlugin({
      inputFile: "static/tailwind.css",
      outputFile: "static/output.css",
    }),
    {
      name: "html-entrypoints-plugin",
      version: "1.0.0",
      build: {
        buildConfig: {
          entrypoints: Object.values(router.routes),
          plugins: [
            {
              name: "remove-tailwind-link-plugin",
              setup(build) {
                const fmRemoveClass = "fm_remove";
                const rewriter = new HTMLRewriter().on(
                  `link.${fmRemoveClass}`,
                  {
                    element(element) {
                      element.remove();
                    },
                  }
                );
                build.onLoad({ filter: /\.html$/ }, async (args) => {
                  return {
                    contents: rewriter.transform(
                      (args.__chainedContents as string) ??
                        (await Bun.file(args.path).text())
                    ),
                    loader: "html",
                  };
                });
                build.onEnd(async (result) => {
                  const rewriter = new HTMLRewriter().on("head", {
                    element(element) {
                      element.append(
                        `<link href="/static/output.css" rel="stylesheet" />`,
                        { html: true }
                      );
                    },
                  });
                  await Promise.all(
                    result.outputs
                      .filter((out) => out.path.endsWith(".html"))
                      .map(async (out) => {
                        await Bun.write(
                          out.path,
                          rewriter.transform(
                            (await Bun.file(out.path).text()) as string
                          )
                        );
                      })
                  );

                  cpSync("./static", "./.frame-master/build/static", {
                    recursive: true,
                  });

                  const glob = Array.from(
                    new Bun.Glob("**").scanSync({
                      cwd: ".frame-master/build/static",
                      onlyFiles: true,
                      absolute: true,
                    })
                  ).filter((file) => !file.endsWith("tailwind.css"));

                  result.outputs.push(
                    ...glob.map(
                      (file) =>
                        ({
                          ...Bun.file(file),
                          hash: "",
                          path: file,
                          loader: "file",
                          kind: "asset",
                          sourcemap: null,
                        } as Bun.BuildArtifact)
                    )
                  );
                });
              },
            },
          ],
        },
      },
    },
  ],
} satisfies FrameMasterConfig;
