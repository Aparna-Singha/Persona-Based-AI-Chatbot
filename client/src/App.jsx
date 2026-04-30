import { useRef, useState } from "react";

const PERSONAS = [
  {
    id: "anshuman",
    name: "Anshuman",
    initial: "AN",
    badge: "First Principles",
    summary: "Sharp, practical, and first-principles driven.",
    suggestions: [
      "Help me think through a difficult choice.",
      "How can I stay calm while working on this project?",
      "Give me reflective feedback on my idea.",
    ],
  },
  {
    id: "abhimanyu",
    name: "Abhimanyu",
    initial: "AB",
    badge: "Builder Lens",
    summary: "Warm, mission-driven, and outcomes-focused.",
    suggestions: [
      "Create a quick action plan for my next task.",
      "What is the strongest move I can make right now?",
      "Challenge my approach and make it sharper.",
    ],
  },
  {
    id: "kshitij",
    name: "Kshitij",
    initial: "KS",
    badge: "Structured Guide",
    summary: "Clear, structured, and teacher-like.",
    suggestions: [
      "Imagine a better version of this chatbot.",
      "Suggest creative features for this assignment.",
      "Help me explore a future-focused idea.",
    ],
  },
];

const RETRY_DELAY_MS = 400;
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function getApiUrl(path) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function requestChat(persona, message) {
  const response = await fetch(getApiUrl("/api/chat"), {
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
  const status = Number(error?.status);

  if (error instanceof TypeError) {
    return "I could not reach the chat server. Check that the backend is running, then try again.";
  }

  if (status === 400) {
    return "Please send a message with a valid persona selected.";
  }

  if (status === 401 || status === 403) {
    return "The chat service is not configured to answer right now.";
  }

  if (status === 429) {
    return "The AI service is temporarily busy. Please try again later.";
  }

  if (status >= 500) {
    return "The server is having trouble replying right now. Please try again in a moment.";
  }

  return "Something went wrong while sending your message. Please try again.";
}

function PersonaSwitcher({ personas, activePersonaId, onPersonaChange }) {
  return (
    <div className="persona-list" aria-label="Personas">
      {personas.map((option) => {
        const isActive = option.id === activePersonaId;

        return (
          <button
            key={option.id}
            type="button"
            className={isActive ? "persona-card active" : "persona-card"}
            onClick={() => onPersonaChange(option.id)}
            aria-pressed={isActive}
          >
            <div className="persona-avatar" aria-hidden="true">
              {option.initial}
            </div>

            <div className="persona-card-copy">
              <span className="persona-name">{option.name}</span>
              <span className="persona-badge">{option.badge}</span>
            </div>

            {isActive ? <span className="active-indicator" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function SuggestionChips({ suggestions, onSelect }) {
  return (
    <div className="suggestion-strip" aria-label="Prompt ideas">
      <div className="chip-list">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="suggestion-chip"
            onClick={() => onSelect(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatInput({ value, onChange, onSubmit, loading, personaName, inputRef }) {
  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit(event);
    }
  }

  return (
    <form className="chat-input" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="chat-message">
        Message {personaName}
      </label>

      <div className="composer-shell">
        <textarea
          ref={inputRef}
          id="chat-message"
          name="message"
          rows="3"
          placeholder={`Message ${personaName}...`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />

        <button
          type="submit"
          disabled={loading}
          aria-label={loading ? `Sending message to ${personaName}` : `Send message to ${personaName}`}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}

function TypingIndicator({ personaName }) {
  return (
    <div className="message-row assistant">
      <div className="message-bubble typing-indicator" role="status" aria-live="polite">
        <p className="message-meta">{personaName}</p>
        <div className="typing-line">
          <span>Thinking</span>
          <span className="typing-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ message, personaName }) {
  const isUser = message.role === "user";

  return (
    <article className={isUser ? "message-row user" : "message-row assistant"}>
      <div className="message-bubble">
        <p className="message-meta">{isUser ? "You" : personaName}</p>
        <p className="message-text">{message.content}</p>
      </div>
    </article>
  );
}

function EmptyChat({ persona }) {
  return (
    <div className="empty-chat">
      <div className="empty-avatar" aria-hidden="true">
        {persona.initial}
      </div>
      <div className="empty-copy">
        <h3>Start chatting with {persona.name}</h3>
        <p>{persona.summary}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [persona, setPersona] = useState("anshuman");
  const [draft, setDraft] = useState("");
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const inputRef = useRef(null);

  const activePersona = PERSONAS.find((option) => option.id === persona) || PERSONAS[0];

  function handlePersonaChange(nextPersona) {
    if (nextPersona === persona) {
      return;
    }

    requestIdRef.current += 1;
    setPersona(nextPersona);
    setDraft("");
    setConversation([]);
    setError("");
    setLoading(false);
  }

  function handleSuggestionSelect(suggestion) {
    setDraft(suggestion);
    setError("");
    inputRef.current?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const trimmedMessage = draft.trim();

    if (!trimmedMessage) {
      setError("Enter a message before sending.");
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const selectedPersona = persona;
    const selectedPersonaName = activePersona.name;
    const userMessage = {
      id: `${requestId}-user`,
      role: "user",
      content: trimmedMessage,
    };

    setConversation((currentConversation) => [...currentConversation, userMessage]);
    setDraft("");
    setError("");
    setLoading(true);

    try {
      let data;

      try {
        data = await requestChat(selectedPersona, trimmedMessage);
      } catch (firstError) {
        if (!shouldRetryRequest(firstError)) {
          throw firstError;
        }

        await wait(RETRY_DELAY_MS);

        if (requestIdRef.current !== requestId) {
          return;
        }

        data = await requestChat(selectedPersona, trimmedMessage);
      }

      if (requestIdRef.current !== requestId) {
        return;
      }

      setConversation((currentConversation) => [
        ...currentConversation,
        {
          id: `${requestId}-assistant`,
          role: "assistant",
          content: data.reply || "I did not receive a reply. Please try again.",
          personaName: selectedPersonaName,
        },
      ]);
    } catch (requestError) {
      if (requestIdRef.current === requestId) {
        setError(getFriendlyErrorMessage(requestError));
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  return (
    <main className="app-shell" data-persona={persona}>
      <header className="topbar">
        <p className="eyebrow">Persona-Based AI Chatbot</p>
      </header>

      <div className="workspace">
        <aside className="persona-panel">
          <div className="sidebar-header">
            <p className="section-label">Personas</p>
          </div>

          <PersonaSwitcher
            personas={PERSONAS}
            activePersonaId={persona}
            onPersonaChange={handlePersonaChange}
          />
        </aside>

        <section className="chat-panel" aria-label={`Chat with ${activePersona.name}`}>
          <header className="chat-header">
            <div className="chat-identity">
              <div className="avatar" aria-hidden="true">
                {activePersona.initial}
              </div>

              <div className="chat-heading">
                <p className="section-label">Conversation</p>
                <h1>{activePersona.name}</h1>
              </div>
            </div>

            <span className="persona-tag">{activePersona.badge}</span>
          </header>

          <div className="chat-feed" aria-live="polite">
            {conversation.length === 0 ? <EmptyChat persona={activePersona} /> : null}

            {conversation.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                personaName={message.personaName || activePersona.name}
              />
            ))}

            {loading ? <TypingIndicator personaName={activePersona.name} /> : null}
          </div>

          <footer className="chat-footer">
            {error ? (
              <p className="error-banner" role="alert">
                {error}
              </p>
            ) : null}

            <SuggestionChips
              suggestions={activePersona.suggestions}
              onSelect={handleSuggestionSelect}
            />

            <ChatInput
              value={draft}
              onChange={setDraft}
              onSubmit={handleSubmit}
              loading={loading}
              personaName={activePersona.name}
              inputRef={inputRef}
            />
          </footer>
        </section>
      </div>
    </main>
  );
}
