import "dotenv/config";
import app from "./app.js";

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || "0.0.0.0";

console.log(`[server] Starting server on ${host}:${port}`);

const server = app.listen(port, host, () => {
  console.log(`[server] Server listening on ${host}:${port}`);
});

server.on("error", (error) => {
  console.error("[server] Failed to start server:", error);
});
