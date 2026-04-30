# Persona-Based AI Chatbot

Standard full-stack web app scaffold using only:

- React + Vite for the frontend
- Node.js + Express for the backend
- OpenAI API on the backend only

This scaffold intentionally does not include:

- External ML deployment tooling
- Authentication
- A database
- Deployment configuration

## Project Structure

```text
.
├── client/
├── server/
├── .env.example
├── .gitignore
├── prompts.md
└── reflection.md
```

## Frontend

The frontend lives in `client/` and is a small Vite React starter with a persona selector and a basic chat form.

Typical commands:

```bash
cd client
npm install
npm run dev
```

## Backend

The backend lives in `server/` and exposes:

- `GET /api/health`
- `GET /api/personas`
- `POST /api/chat`

Persona prompts are stored as separate files in `server/prompts/`.

Typical commands:

```bash
cd server
npm install
npm run dev
```

Use the variables listed in `.env.example` to populate your environment before starting the server.

## Next Build Steps

1. Install dependencies in `client/` and `server/`.
2. Add your real OpenAI API key to your environment.
3. Expand the chat UX and refine the persona prompts.
4. Add validation and error handling polish as needed.
