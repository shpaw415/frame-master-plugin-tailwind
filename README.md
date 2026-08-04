# frame-master-plugin-tailwind

Tailwind CSS integration for [Frame-Master](https://github.com/shpaw415/frame-master): compile, serve, optional HTML injection, and live CSS reload.

## Features

- **Tailwind CSS v4** — works with `@tailwindcss/cli` and `tailwindcss` ≥ 4.1.18
- **Auto-compilation** — one-shot minify on startup; `--watch` in development
- **Optional HTML inject** — runtime and/or production build (both default **on**)
- **HMR** — WebSocket reload of `/tailwind.css` without a full page refresh
- **Stable public URLs** — CSS, bootstrap, and WS paths are fixed regardless of `outputFile`

## Installation

```bash
bun add frame-master-plugin-tailwind
# peers (if not already present)
bun add -d tailwindcss @tailwindcss/cli
```

## Quick start

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
    }),
  ],
} satisfies FrameMasterConfig;
```

```css
/* static/index.css */
@import "tailwindcss";
```

```bash
bun dev
```

## Public URLs (contract)

| Asset | Path |
|--------|------|
| Compiled CSS | `/tailwind.css` |
| HMR client | `/tailwind/bootstrap.js` |
| WebSocket | `/ws/tailwind` (dev only) |

`outputFile` is only the **on-disk** compile target. Browsers always load `/tailwind.css`.

## Configuration

```typescript
type TailwindPluginProps = {
  inputFile: string;
  outputFile: string;
  options?: {
    /** Inject CSS + HMR bootstrap into HTML responses. @default true */
    autoInjectInHtml?: boolean;
    /** Inject CSS into HTML entrypoints on production build. @default true */
    autoInjectInBuild?: boolean;
    /** CLI runner: "bun" | "bunx" | "npx". @default "bun" */
    runtime?: "bun" | "bunx" | "npx";
  };
};
```

### Manual HTML (no auto-inject)

```typescript
TailwindPlugin({
  inputFile: "static/index.css",
  outputFile: "static/tailwind.css",
  options: {
    autoInjectInHtml: false,
    autoInjectInBuild: false,
  },
});
```

```html
<link href="/tailwind.css" rel="stylesheet" id="__tailwindcss__" />
<!-- Dev HMR only -->
<script src="/tailwind/bootstrap.js" id="__tailwind_bootstrap__"></script>
```

Keep `id="__tailwindcss__"` so HMR can cache-bust the stylesheet.

### Runtime CLI

If `bun tailwindcss` fails on your machine:

```typescript
options: { runtime: "bunx" } // or "npx"
```

The plugin prefers a local `@tailwindcss/cli` install when present.

## Behavior notes

- **Dev:** watches `outputFile`, restarts the Tailwind CLI with backoff on crash, reconnecting HMR client (`ws` / `wss`).
- **Prod compile:** throws a structured error on failure (does not hard-kill via `process.exit` alone through Frame-Master hooks).
- **Config reload:** stops the file watcher and Tailwind child process cleanly.
- **WebSockets:** only connections upgraded with `{ tailwind: true }` are tracked.

## Scripts (contributors)

```bash
bun install
bun test
bun run build-bootstrap
bun run format   # Biome
```

## License

MIT
