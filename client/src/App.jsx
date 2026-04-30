import { useState } from "react";

const PERSONAS = [
  {
    id: "anshuman",
    name: "Anshuman",
    summary: "Thoughtful, calm, and reflective.",
  },
  {
    id: "abhimanyu",
    name: "Abhimanyu",
    summary: "Direct, strategic, and action-oriented.",
  },
  {
    id: "kshitij",
    name: "Kshitij",
    summary: "Imaginative, expansive, and future-facing.",
  },
];
const RETRY_DELAY_MS = 400;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function requestChat(persona, message) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      persona,
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    const requestError = new Error(data.error || "Something went wrong.");
    requestError.status = response.status;
    throw requestError;
  }

  return data;
}

function shouldRetryRequest(error) {
  return error instanceof TypeError || Number(error?.status) >= 500;
}

function getFriendlyErrorMessage(error) {
  if (shouldRetryRequest(error)) {
    return "The server is having trouble replying right now. Please try again in a moment.";
  }

  return error?.message || "Unable to reach the server.";
}

export default function App() {
  const [persona, setPersona] = useState("anshuman");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setError("Enter a message to start the conversation.");
      return;
    }

    setLoading(true);
    setError("");
    setReply("");

    try {
      let data;

      try {
        data = await requestChat(persona, trimmedMessage);
      } catch (firstError) {
        if (!shouldRetryRequest(firstError)) {
          throw firstError;
        }

        await wait(RETRY_DELAY_MS);
        data = await requestChat(persona, trimmedMessage);
      }

      setReply(data.reply || "");
    } catch (requestError) {
      setError(getFriendlyErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Persona-Based AI Chatbot</p>
        <h1>React + Vite frontend, Express backend, Gemini on the server.</h1>
        <p className="lede">
          This starter keeps the UI simple while the persona logic stays behind
          the API layer.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Choose a persona</h2>
          <p>Select which backend prompt file should guide the reply.</p>
        </div>

        <div className="persona-grid">
          {PERSONAS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={option.id === persona ? "persona-card active" : "persona-card"}
              onClick={() => setPersona(option.id)}
            >
              <span>{option.name}</span>
              <small>{option.summary}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Starter chat form</h2>
          <p>The form posts to the Express API at <code>/api/chat</code>.</p>
        </div>

        <form className="chat-form" onSubmit={handleSubmit}>
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            name="message"
            rows="6"
            placeholder="Ask the selected persona anything..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />

          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? "Thinking..." : "Send message"}
            </button>
          </div>
        </form>

        {error ? <p className="status error">{error}</p> : null}

        <div className="response-card">
          <p className="response-label">Latest response</p>
          <p>{reply || "Your backend reply will appear here."}</p>
        </div>
      </section>
    </main>
  );
}
