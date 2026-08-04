import { join } from "node:path";
import { isDev, isProd } from "frame-master/utils";
import {
	PUBLIC_BOOTSTRAP_PATH,
	PUBLIC_CSS_PATH,
	PUBLIC_WS_PATH,
} from "./constants";
import type { TailwindWsData } from "./types";

function cssHeaders(): HeadersInit {
	if (isDev()) {
		return {
			"Content-Type": "text/css; charset=utf-8",
			"Cache-Control": "no-store, must-revalidate",
		};
	}
	return {
		"Content-Type": "text/css; charset=utf-8",
		"Cache-Control": "public, max-age=31536000, immutable",
	};
}

function jsHeaders(): HeadersInit {
	return {
		"Content-Type": "application/javascript; charset=utf-8",
		"Cache-Control": isProd()
			? "public, max-age=31536000, immutable"
			: "no-store",
	};
}

/**
 * @param getOutputFile - returns the current compiled CSS path (may be absolute after createContext)
 */
export function createRoutes(
	getOutputFile: () => string,
): Record<string, unknown> {
	const bootstrapPath = join(import.meta.dir, "..", "dist", "bootstrap.js");

	const routes: Record<string, unknown> = {
		[PUBLIC_CSS_PATH]: () =>
			new Response(Bun.file(getOutputFile()), {
				headers: cssHeaders(),
			}),
		[PUBLIC_BOOTSTRAP_PATH]: () =>
			new Response(Bun.file(bootstrapPath).stream(), {
				headers: jsHeaders(),
			}),
	};

	if (isDev()) {
		routes[PUBLIC_WS_PATH] = (
			req: Request,
			server: {
				upgrade: (req: Request, opts: { data: TailwindWsData }) => boolean;
			},
		) => {
			const success = server.upgrade(req, {
				data: { tailwind: true },
			});
			return new Response(success ? "welcome to tailwind ws" : undefined, {
				status: success ? 101 : 400,
			});
		};
	}

	return routes;
}
