export const AVAILABLE_MODELS = [
    "openrouter/free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "deepseek/deepseek-v4-flash:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "minimax/minimax-m2.5:free",
    "nvidia/nemotron-3-super:free",
    "deepseek/deepseek-r1:free",
    "openai/gpt-oss-120b:free"
] as const;

export type AvailableModel = (typeof AVAILABLE_MODELS)[number];

export const DEFAULT_PROMPT =
    "You are an expert in Behaviour-Driven Development. Review the following Gherkin scenarios and suggest concrete improvements. Focus on: clarity of steps, missing edge cases, ambiguous language, and structural issues. Format your response in Markdown.";

export const DEFAULT_MODEL = AVAILABLE_MODELS[0];
