# AI security

External text (notes, news, PDFs) is untrusted.

Controls in this build:

- `detectPromptInjection`
- `sanitizeForLlm` / `redactSecrets` / `assertNoSecretInPrompt`
- Research permissions: `read` or `read+propose`
- No broker credentials in prompts
- Cost manager refuses spend when paid services are off
- AI desk refuses flagged injection prompts

Not implemented: remote URL browsing by agents, tool sandbox beyond allowlists.
