import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { loadPersonaPrompt, personaOptions } from "../personas.js";

const router = Router();
const allowedRoles = new Set(["user", "assistant"]);
const model = "gemini-2.5-flash";
const transientErrorCodes = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
]);
let geminiClient = null;

function isValidMessage(message) {
  return (
    message &&
    typeof message === "object" &&
    allowedRoles.has(message.role) &&
    typeof message.content === "string" &&
    message.content.trim().length > 0
  );
}

function buildPrompt(messages, systemPrompt) {
  const transcript = messages
    .map(({ role, content }) => `${role.toUpperCase()}: ${content.trim()}`)
    .join("\n\n");

  return [
    "System prompt:",
    systemPrompt,
    "",
    "Conversation so far:",
    transcript,
    "",
    "Write the next assistant reply only.",
  ].join("\n");
}

function getGeminiClient() {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  return geminiClient;
}

function getErrorMetadata(error) {
  return {
    status: error?.status,
    code: error?.code || error?.cause?.code,
    details: error?.details || error?.errorDetails || error?.cause?.details,
  };
}

function isTransientGeminiError(error) {
  const status = Number(error?.status);
  const code = String(error?.code || error?.cause?.code || "").toUpperCase();

  return (
    Number.isInteger(status) &&
      [429, 500, 502, 503, 504].includes(status)
  ) || transientErrorCodes.has(code);
}

router.post("/chat", async (req, res) => {
  const persona = req.body?.persona;
  const messages = req.body?.messages;

  console.log("[server] /api/chat hit", {
    persona,
    messageCount: Array.isArray(messages) ? messages.length : 0,
  });

  if (!personaOptions.includes(persona)) {
    return res.status(400).json({
      error: `Invalid persona. Use one of: ${personaOptions.join(", ")}.`,
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "Messages must be a non-empty array.",
    });
  }

  if (!messages.every(isValidMessage)) {
    return res.status(400).json({
      error: "Each message must include a valid role and non-empty content.",
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "The server is not configured to reach Gemini yet.",
    });
  }

  try {
    const systemPrompt = loadPersonaPrompt(persona);

    if (!systemPrompt) {
      return res.status(400).json({
        error: `Invalid persona. Use one of: ${personaOptions.join(", ")}.`,
      });
    }

    const ai = getGeminiClient();

    console.log("[server] Calling Gemini", {
      persona,
      model,
    });

    const response = await ai.models.generateContent({
      model,
      contents: buildPrompt(messages, systemPrompt),
    });

    console.log("[server] Gemini response received", {
      hasText: Boolean(response.text?.trim()),
    });

    return res.json({
      reply: response.text?.trim() || "",
    });
  } catch (error) {
    const errorMetadata = getErrorMetadata(error);

    console.error("[server] Gemini chat request failed");
    console.error("[server] Gemini error message:", error?.message || "Unknown error");

    if (error?.stack) {
      console.error("[server] Gemini error stack:", error.stack);
    }

    if (errorMetadata.status || errorMetadata.code || errorMetadata.details) {
      console.error("[server] Gemini error metadata:", errorMetadata);
    }

    return res.status(500).json({
      error: isTransientGeminiError(error)
        ? "The AI service is temporarily unavailable. Please try again in a moment."
        : "Unable to get a reply right now. Please try again in a moment.",
    });
  }
});

export default router;
