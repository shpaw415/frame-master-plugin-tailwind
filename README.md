# frame-master-plugin-tailwind

A powerful Tailwind CSS integration plugin for Frame-Master, providing automatic CSS compilation, live reload, and seamless integration with your Bun-powered application.

## 🚀 Features

- **🎨 Tailwind CSS v4.1.15+** - Latest Tailwind CSS with all modern features
- **⚡ Auto-compilation** - Automatic CSS compilation in development and production
- **🔥 Hot Module Replacement** - Live CSS reload without page refresh
- **📦 Zero Config** - Works out of the box with sensible defaults
- **🌐 WebSocket Integration** - Real-time CSS updates via WebSocket
- **🚀 Production Ready** - Optimized builds for production deployment

## 📦 Installation

```bash
bun add frame-master-plugin-tailwind
```

This will automatically install Tailwind CSS v4.1.15+ and the Tailwind CLI.

## 🎯 Quick Start

### 1. Configure Frame-Master

Add the plugin to your `frame-master.config.ts`:

```typescript
// frame-master.config.ts
import type { FrameMasterConfig } from "frame-master/server/types";
import TailwindPlugin from "frame-master-plugin-tailwind";

export default {
  HTTPServer: { port: 3000 },
  plugins: [
    TailwindPlugin({
      inputFile: "static/index.css", // Your Tailwind input file
      outputFile: "static/tailwind.css", // Compiled output file
    }),
  ],
} satisfies FrameMasterConfig;
```

### 2. Create Input CSS File

Create your Tailwind input file (e.g., `static/index.css`):

```css
/* static/index.css */
@import "tailwindcss";
```

Or with custom configurations:

```css
/* static/index.css */
@import "tailwindcss";

@layer base {
  :root {
    --color-primary: #3b82f6;
  }
}

@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-colors;
  }

  .btn-primary {
    @apply bg-blue-600 text-white hover:bg-blue-700;
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

### 3. Start Your Server

```bash
bun dev
```

The plugin will:

- ✅ Automatically compile your Tailwind CSS
- ✅ Inject the compiled CSS into your HTML
- ✅ Watch for file changes
- ✅ Reload CSS in real-time via WebSocket

## ⚙️ Configuration

### Plugin Options

```typescript
type TailwindPluginProps = {
  inputFile: string; // Path to your Tailwind input CSS file
  outputFile: string; // Path where compiled CSS will be output
};
```

### Example Configurations

**Basic Setup:**

```typescript
TailwindPlugin({
  inputFile: "static/index.css",
  outputFile: "static/tailwind.css",
});
```

**Monorepo Setup:**

```typescript
TailwindPlugin({
  inputFile: "apps/web/styles/index.css",
  outputFile: "apps/web/public/tailwind.css",
});
```

## 🔌 Plugin Features

### Automatic CSS Injection

The plugin automatically injects the compiled CSS into your HTML:

```html
<head>
  <!-- Automatically injected -->
  <link href="/tailwind.css" rel="stylesheet" id="__tailwindcss__" />

  <!-- In development only -->
  <script src="/tailwind/bootstrap.js"></script>
</head>
```

### WebSocket Live Reload

In development mode, the plugin establishes a WebSocket connection for instant CSS updates:

- **Endpoint:** `ws://localhost:3000/ws/tailwind`
- **Message:** Sends `"reload"` when CSS changes are detected
- **Behavior:** Automatically refreshes the CSS without page reload

### Routes

The plugin registers the following routes:

- **`/tailwind.css`** - Serves the compiled CSS file
- **`/tailwind/bootstrap.js`** - Serves the WebSocket client script (dev only)
- **`/ws/tailwind`** - WebSocket endpoint for live reload (dev only)

## 🎨 Using Tailwind CSS

### In React Components (with React SSR Plugin)

```tsx
// src/pages/index.tsx
export default function HomePage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Frame-Master
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Build beautiful apps with Tailwind CSS
        </p>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Get Started
        </button>
      </div>
    </div>
  );
}
```

### In HTML Templates

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My App</title>
    <!-- CSS is automatically injected here -->
  </head>
  <body>
    <div class="flex items-center justify-center min-h-screen bg-gray-100">
      <div class="p-8 bg-white rounded-xl shadow-lg">
        <h1 class="text-3xl font-bold text-gray-900">Hello World</h1>
      </div>
    </div>
  </body>
</html>
```

## 🔧 Advanced Usage

### Custom Tailwind Configuration

Create a `tailwind.config.js` in your project root:

```javascript
// tailwind.config.js
export default {
  content: ["./src/**/*.{ts,tsx,js,jsx}", "./static/**/*.html"],
  theme: {
    extend: {
      colors: {
        primary: "#3b82f6",
        secondary: "#8b5cf6",
      },
    },
  },
  plugins: [],
};
```

### Production Optimization

The plugin automatically optimizes for production:

- ✅ WebSocket server disabled in production
- ✅ Bootstrap script not injected in production
- ✅ CSS served with proper content-type headers
- ✅ Automatic CSS purging (via Tailwind)

## 🐛 Troubleshooting

### CSS Not Loading

**Issue:** CSS file not found or not loading

**Solution:**

1. Verify `inputFile` path exists
2. Check `outputFile` directory is writable

### Changes Not Reflecting

**Issue:** CSS changes not appearing in browser

**Solution:**

1. Verify WebSocket connection in browser DevTools (Network tab)
2. Clear browser cache
3. Restart the development server

### WebSocket Connection Failed

**Issue:** WebSocket fails to connect

**Solution:**

1. Ensure you're in development mode (`NODE_ENV !== "production"`)
2. Check that port 3000 (or your configured port) is accessible
3. Verify no firewall blocking WebSocket connections

### Build Errors

**Issue:** Tailwind CLI not found or build fails

**Solution:**

```bash
# Reinstall dependencies
bun install

# Rebuild bootstrap script
bun run build-bootstrap

# Clear Bun cache
rm -rf node_modules/.cache
```

## 📚 API Reference

### Plugin Export

```typescript
function TailwindPlugin(options: TailwindPluginProps): FrameMasterPlugin;
```

### Type Definitions

```typescript
type TailwindPluginProps = {
  inputFile: string; // Path to Tailwind input CSS
  outputFile: string; // Path for compiled CSS output
};
```

### Global Variables

The plugin uses these global variables (managed internally):

```typescript
globalThis.__BUN_TAILWIND_PLUGIN_CHILD_PROCESS__; // Tailwind CLI subprocess
globalThis.__SOCKETS_TAILWIND__; // Active WebSocket connections
```

## 🤝 Integration with Other Plugins

### With React SSR Plugin

```typescript
import ReactSSRPlugin from "frame-master-plugin-react-ssr/plugin";
import TailwindPlugin from "frame-master-plugin-tailwind";

export default {
  HTTPServer: { port: 3000 },
  plugins: [
    ReactSSRPlugin({
      pathToPagesDir: "src/pages",
      pathToBuildDir: ".frame-master/build",
    }),
    TailwindPlugin({
      inputFile: "static/index.css",
      outputFile: "static/tailwind.css",
    }),
  ],
} satisfies FrameMasterConfig;
```

### With Session Plugin

```typescript
import SessionPlugin from "frame-master-plugin-session";
import TailwindPlugin from "frame-master-plugin-tailwind";

export default {
  HTTPServer: { port: 3000 },
  plugins: [
    SessionPlugin(),
    TailwindPlugin({
      inputFile: "static/index.css",
      outputFile: "static/tailwind.css",
    }),
  ],
} satisfies FrameMasterConfig;
```

## 📝 Best Practices

1. **Keep Input CSS Minimal** - Use `@import "tailwindcss"` and custom layers
2. **Use Tailwind Classes** - Leverage utility classes instead of custom CSS
3. **Organize Styles** - Use `@layer` for custom components and utilities
4. **Production Builds** - Let Tailwind automatically purge unused CSS

## 🔗 Links

- [Frame-Master Documentation](https://github.com/shpaw415/frame-master)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS v4 Features](https://tailwindcss.com/blog/tailwindcss-v4)

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

Built with ❤️ for the Frame-Master ecosystem
