import "dotenv/config";
import app from "./app.js";

const port = Number(process.env.PORT || 5000);
const host = "127.0.0.1";

console.log(`[server] Starting server on ${host}:${port}`);

const server = app.listen(port, host, () => {
  console.log(`[server] Server listening on http://localhost:${port}`);
});

server.on("error", (error) => {
  console.error("[server] Failed to start server:", error);
});
