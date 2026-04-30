# Prompt Notes

Persona prompts are kept as separate backend-side files so the frontend never contains system prompt text or API secrets.

## Prompt Files

- `server/prompts/anshuman.md`
- `server/prompts/abhimanyu.md`
- `server/prompts/kshitij.md`

## Why This Layout

- Keeps prompt logic on the server where the OpenAI API call happens
- Makes each persona easy to edit independently
- Avoids mixing persona instructions into frontend code

## Prompt Usage

The server reads the selected persona file at request time and sends that content to the OpenAI Responses API as `instructions`.

## Editing Guidance

- Keep each persona prompt focused on tone, behavior, and boundaries
- Avoid embedding secrets or environment-specific values in prompt files
- Prefer concise, testable persona differences over vague stylistic wording

