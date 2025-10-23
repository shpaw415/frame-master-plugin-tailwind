const ws = new WebSocket("ws://" + location.host + "/ws/tailwind");

const style = document.getElementById("__tailwindcss__");

ws.addEventListener("message", (event) => {
  if (event.data === "reload") {
    style?.setAttribute("href", "/tailwind.css?t=" + Date.now());
  }
});
