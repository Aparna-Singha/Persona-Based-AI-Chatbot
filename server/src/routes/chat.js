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

function collectStrings(value, results = [], seen = new WeakSet()) {
  if (value == null) {
    return results;
  }

  if (typeof value === "string") {
    results.push(value);
    return results;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    results.push(String(value));
    return results;
  }

  if (typeof value !== "object") {
    return results;
  }

  if (seen.has(value)) {
    return results;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, results, seen));
    return results;
  }

  Object.values(value).forEach((item) => collectStrings(item, results, seen));
  return results;
}

function getErrorSearchText(error) {
  return collectStrings({
    message: error?.message,
    status: error?.status,
    code: error?.code,
    details: error?.details,
    errorDetails: error?.errorDetails,
    cause: error?.cause,
  })
    .join(" ")
    .toUpperCase();
}

function parseDurationToMilliseconds(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value * 1000;
  }

  if (typeof value === "string") {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/i);

    if (!match) {
      return null;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === "ms") {
      return amount;
    }

    if (unit === "s") {
      return amount * 1000;
    }

    if (unit === "m") {
      return amount * 60 * 1000;
    }

    if (unit === "h") {
      return amount * 60 * 60 * 1000;
    }
  }

  if (value && typeof value === "object") {
    const seconds = Number(value.seconds || 0);
    const nanos = Number(value.nanos || 0);

    if (Number.isFinite(seconds) || Number.isFinite(nanos)) {
      return (seconds * 1000) + (nanos / 1_000_000);
    }
  }

  return null;
}

function extractRetryDelayMilliseconds(value, seen = new WeakSet()) {
  if (value == null || typeof value === "function") {
    return null;
  }

  const directDelay = parseDurationToMilliseconds(value);

  if (directDelay !== null) {
    return directDelay;
  }

  if (typeof value === "string") {
    const retryMatch = value.match(
      /retry(?:ing)?(?:\s+\w+)*\s+(?:after|in)\s+(\d+(?:\.\d+)?)\s*(ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i,
    );

    if (!retryMatch) {
      return null;
    }

    const amount = Number(retryMatch[1]);
    const unit = retryMatch[2].toLowerCase();

    if (unit === "ms") {
      return amount;
    }

    if (unit.startsWith("s")) {
      return amount * 1000;
    }

    if (unit.startsWith("m")) {
      return amount * 60 * 1000;
    }

    if (unit.startsWith("h")) {
      return amount * 60 * 60 * 1000;
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedDelay = extractRetryDelayMilliseconds(item, seen);

      if (nestedDelay !== null) {
        return nestedDelay;
      }
    }

    return null;
  }

  if ("retryDelay" in value) {
    const nestedDelay = extractRetryDelayMilliseconds(value.retryDelay, seen);

    if (nestedDelay !== null) {
      return nestedDelay;
    }
  }

  if ("retry_delay" in value) {
    const nestedDelay = extractRetryDelayMilliseconds(value.retry_delay, seen);

    if (nestedDelay !== null) {
      return nestedDelay;
    }
  }

  for (const nestedValue of Object.values(value)) {
    const nestedDelay = extractRetryDelayMilliseconds(nestedValue, seen);

    if (nestedDelay !== null) {
      return nestedDelay;
    }
  }

  return null;
}

function formatRetryDelay(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return null;
  }

  if (milliseconds < 1000) {
    return "a moment";
  }

  const seconds = Math.ceil(milliseconds / 1000);

  if (seconds < 60) {
    return `about ${seconds} second${seconds === 1 ? "" : "s"}`;
  }

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) {
    return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.ceil(minutes / 60);
  return `about ${hours} hour${hours === 1 ? "" : "s"}`;
}

function isQuotaOrRateLimitError(error) {
  const status = Number(error?.status);
  const searchText = getErrorSearchText(error);

  return (
    status === 429 ||
    searchText.includes("RESOURCE_EXHAUSTED") ||
    searchText.includes("QUOTA EXCEEDED") ||
    searchText.includes("RATE LIMIT") ||
    searchText.includes("TOO MANY REQUESTS")
  );
}

function getQuotaExceededMessage(error) {
  if (!isQuotaOrRateLimitError(error)) {
    return null;
  }

  const retryDelay = extractRetryDelayMilliseconds([
    error?.details,
    error?.errorDetails,
    error?.cause?.details,
    error?.message,
  ]);
  const retryHint = formatRetryDelay(retryDelay);

  if (retryHint) {
    return `Gemini free-tier quota exceeded. Please wait ${retryHint} and try again.`;
  }

  return "Gemini free-tier quota exceeded. Please wait a bit and try again.";
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
    const quotaExceededMessage = getQuotaExceededMessage(error);

    console.error("[server] Gemini chat request failed");
    console.error("[server] Gemini error message:", error?.message || "Unknown error");

    if (error?.stack) {
      console.error("[server] Gemini error stack:", error.stack);
    }

    if (errorMetadata.status || errorMetadata.code || errorMetadata.details) {
      console.error("[server] Gemini error metadata:", errorMetadata);
    }

    if (quotaExceededMessage) {
      return res.status(429).json({
        error: quotaExceededMessage,
      });
    }

    return res.status(500).json({
      error: isTransientGeminiError(error)
        ? "The AI service is temporarily unavailable. Please try again in a moment."
        : "Unable to get a reply right now. Please try again in a moment.",
    });
  }
});

export default router;
