# Quick exemple

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
bun add frame-master-plugin-tailwind
bun add -d tailwindcss @tailwindcss/cli
bun dev
```

Browsers always load `/tailwind.css`. In dev, `/tailwind/bootstrap.js` and `/ws/tailwind` provide CSS HMR.
