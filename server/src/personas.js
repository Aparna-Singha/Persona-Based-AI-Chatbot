import abhimanyuPrompt from "../prompts/abhimanyu.js";
import anshumanPrompt from "../prompts/anshuman.js";
import kshitijPrompt from "../prompts/kshitij.js";

const personaPrompts = {
  anshuman: anshumanPrompt,
  abhimanyu: abhimanyuPrompt,
  kshitij: kshitijPrompt,
};

export const personaOptions = Object.keys(personaPrompts);

export function loadPersonaPrompt(persona) {
  return personaPrompts[persona] || null;
}
