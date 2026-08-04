/**
 * Dev HMR client: reconnecting WebSocket that cache-busts the Tailwind stylesheet.
 * Built to dist/bootstrap.js via `bun run build-bootstrap`.
 */
const CSS_ID = "__tailwindcss__";
const WS_PATH = "/ws/tailwind";
const CSS_PATH = "/tailwind.css";

const MAX_BACKOFF_MS = 10_000;
const BASE_BACKOFF_MS = 500;

let backoff = BASE_BACKOFF_MS;
let socket: WebSocket | null = null;
let closedByPage = false;

function wsUrl(): string {
	const proto = location.protocol === "https:" ? "wss:" : "ws:";
	return `${proto}//${location.host}${WS_PATH}`;
}

function reloadStylesheet(): void {
	const style = document.getElementById(CSS_ID);
	if (!style) return;
	style.setAttribute("href", `${CSS_PATH}?t=${Date.now()}`);
}

function connect(): void {
	if (closedByPage) return;

	try {
		socket = new WebSocket(wsUrl());
	} catch {
		scheduleReconnect();
		return;
	}

	socket.addEventListener("open", () => {
		backoff = BASE_BACKOFF_MS;
	});

	socket.addEventListener("message", (event) => {
		if (event.data === "reload") {
			reloadStylesheet();
		}
	});

	socket.addEventListener("close", () => {
		socket = null;
		scheduleReconnect();
	});

	socket.addEventListener("error", () => {
		// close will fire and reconnect
		socket?.close();
	});
}

function scheduleReconnect(): void {
	if (closedByPage) return;
	const delay = backoff;
	backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
	setTimeout(connect, delay);
}

// Page unload: stop reconnect loops
addEventListener("pagehide", () => {
	closedByPage = true;
	socket?.close();
});

connect();
