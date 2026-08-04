import { isTailwindWsData } from "./types";

/** Active Tailwind HMR sockets only (filtered by upgrade data). */
const sockets = new Set<Bun.ServerWebSocket<unknown>>();

export function trackTailwindSocket(ws: Bun.ServerWebSocket<unknown>): void {
	if (!isTailwindWsData(ws.data)) return;
	sockets.add(ws);
}

export function untrackTailwindSocket(ws: Bun.ServerWebSocket<unknown>): void {
	sockets.delete(ws);
}

export function broadcastCssReload(): void {
	for (const ws of sockets) {
		try {
			if (isTailwindWsData(ws.data)) {
				ws.send("reload");
			}
		} catch {
			sockets.delete(ws);
		}
	}
}

export function clearTailwindSockets(): void {
	sockets.clear();
}

export function tailwindSocketCount(): number {
	return sockets.size;
}
