import express from "express";
import chatRouter from "./routes/chat.js";
import { personaOptions } from "./personas.js";

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN;

app.use(express.json({ limit: "1mb" }));

if (clientOrigin) {
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", clientOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  });
}

app.get("/api/health", (_req, res) => {
  console.log("[server] /api/health hit");

  res.json({
    ok: true,
  });
});

app.get("/api/personas", (_req, res) => {
  res.json({
    personas: personaOptions,
  });
});

app.use("/api", chatRouter);

export default app;
