/**
 * Cloudflare is an optional inference/render adapter, never a required runtime.
 * Configure CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN in Settings.
 * Workers AI chat is wired through the LLM provider `cloudflare`.
 */
export const cloudflareStatus = {
  mandatory: false,
  llm: "providers/llm CloudflareLlm",
  notes: "Use Workers AI for remote LLM when local/Groq are unavailable. Do not send secrets to the browser.",
};
