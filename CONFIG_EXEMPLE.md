# Config exemple

```typescript
// frame-master.config.ts
import type { FrameMasterConfig } from "frame-master/server/types";
import TailwindPlugin from "frame-master-plugin-tailwind";

export default {
  HTTPServer: { port: 3000 },
  plugins: [
    TailwindPlugin({
      inputFile: "static/index.css",
      outputFile: "static/tailwind.css",
      options: {
        autoInjectInHtml: true,
        autoInjectInBuild: true,
        runtime: "bun",
      },
    }),
  ],
} satisfies FrameMasterConfig;
```

| Option | Default | Meaning |
|--------|---------|---------|
| `autoInjectInHtml` | `true` | Inject CSS + HMR bootstrap into HTML responses |
| `autoInjectInBuild` | `true` | Inject CSS into HTML entrypoints on production build |
| `runtime` | `"bun"` | Tailwind CLI runner: `"bun"` \| `"bunx"` \| `"npx"` |

Requires `frame-master@^4.0.0-0`.

Manual HTML (both inject flags `false`):

```html
<link href="/tailwind.css" rel="stylesheet" id="__tailwindcss__" />
<script src="/tailwind/bootstrap.js" id="__tailwind_bootstrap__"></script>
```
