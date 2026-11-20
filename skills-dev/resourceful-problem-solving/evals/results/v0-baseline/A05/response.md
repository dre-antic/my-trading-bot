Llama 3.1 405B will not run on this PC. The build Ollama publishes, `llama3.1:405b`, is a **243 GB** download, and that is the compressed 4-bit copy. Full 16-bit weights are about **810 GB**, and a 4-bit checkpoint is still about **200 GB** before the conversation cache is added. An RTX 3060 has 12 GB of VRAM and this machine has 32 GB of RAM. The weights do not fit in either, so the model cannot load, and pulling it would only fill the disk.

Source for the file sizes: [Ollama’s Llama 3.1 library](https://ollama.com/library/llama3.1). Source for the precision table: [Hugging Face’s Llama 3.1 memory notes](https://huggingface.co/blog/llama31).

The same page lists the other two official sizes:

| Ollama tag | Download | On this PC |
| --- | --- | --- |
| `llama3.1:405b` | 243 GB | Cannot load |
| `llama3.1:70b` | 43 GB | Larger than system RAM, so it will not run in any useful way |
| `llama3.1:8b` | 4.9 GB | Fits easily |

For email drafts and document summaries, a current 9B–12B model that stays entirely on the 3060 is the better setup. Two tags that fit, confirmed on Ollama’s library pages:

- **`qwen3.5:9b`** — 6.6–7.6 GB, text and image input. This is the one to install. The smaller file leaves room in the 12 GB for the document you are summarizing. Model page: [ollama.com/library/qwen3.5](https://ollama.com/library/qwen3.5).
- **`gemma4:12b`** — 7.7–8.0 GB. Worth a second try if you want slightly stronger writing and your documents are short. Model page: [ollama.com/library/gemma4](https://ollama.com/library/gemma4).

Those pages advertise 256K context. That is the model’s maximum, not what 12 GB can hold. The cache of past tokens grows with context length and will push the model off the GPU if you leave it at 256K. Cap context at 8192 tokens (roughly a long email thread, or about 15–25 pages). Longer documents should be summarized in sections.

Llama 3.1 is free for personal use under Meta’s Llama Community License. It is open-weights, with a license click-through, rather than an OSI open-source license. Qwen 3.5 and Gemma 4 are also free to run locally; each model page states its license. Nothing here phones home to ChatGPT. Text you paste stays on the machine.

## Setup

You need a current NVIDIA driver, about 15 GB of free disk, and [Ollama](https://ollama.com/download).

**Windows (PowerShell):**

```powershell
winget install Ollama.Ollama
ollama pull qwen3.5:9b
@"
FROM qwen3.5:9b
PARAMETER num_ctx 8192
"@ | Set-Content -Encoding utf8 "$HOME\Modelfile"
ollama create email -f "$HOME\Modelfile"
ollama run email
```

**Linux:**

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3.5:9b
cat > "$HOME/Modelfile" << 'EOF'
FROM qwen3.5:9b
PARAMETER num_ctx 8192
EOF
ollama create email -f "$HOME/Modelfile"
ollama run email
```

`ollama pull` downloads once. `ollama run email` opens a chat in the terminal. Quit with `/bye`.

If you would rather click through a window than use the terminal, [LM Studio](https://lmstudio.ai) loads the same kind of model. Pick a Q4 build of Qwen3.5 9B, set GPU offload as high as it will go, and set context to 8192.

## Check that it is actually on the GPU

In a second terminal, while a reply is generating:

```bash
nvidia-smi
ollama ps
```

`ollama ps` should show the model fully on the GPU. A split such as “40% GPU / 60% CPU” means part of the model spilled into system RAM and replies will feel sluggish. Lower `num_ctx` (4096 still covers normal email), or switch to the smaller fallback:

```bash
ollama pull qwen3.5:4b
```

That file is about 3.3–4.0 GB. Use the same Modelfile with `FROM qwen3.5:4b`.

Close games and other GPU apps if loading fails with an out-of-memory error. The Windows desktop already uses some of the 12 GB.

## Emails and summaries

Paste this as the first message when you want a finished email rather than a brainstorm:

```text
You write emails for me. Match the tone of the example. Reply with only the email, no preamble.
Keep it under 150 words, active voice, no jargon.
Example of my tone:
---
Hi Priya,
The numbers are in. Revenue was $42,300, about 8% under the plan, mostly from the delayed launch.
I can walk you through it Thursday.
Sam
---
Now write: decline the Friday meeting, propose Tuesday 10:00, and say the draft will be attached tonight.
```

Putting two or three real emails you have sent into that example slot matters more than which 9B model you picked.

For a document:

```text
Summarize the document for someone who will not read it.
- 5 bullets of what it actually says
- then "Commitments:" with any dates, amounts, and named owners, quoted exactly
- then a 2-sentence bottom line

DOCUMENT:
<paste>
```

If the paste is longer than what 8192 tokens can hold, split it by section, summarize each section, then ask for a summary of those summaries. A book-length PDF will not fit in one prompt on a 12 GB card.

These models can also accept an image, so a photo of a one-page letter works. For a text PDF, copy the text out and paste it. That is more reliable than hoping the vision path reads a dense scan.

## If you specifically want a Llama

```bash
ollama run llama3.1:8b
```

That is the Llama 3.1 that fits, at 4.9 GB. It drafts email fine. Qwen3.5 9B and Gemma 4 12B are the stronger writers on this hardware in the current Ollama library. Llama 4 Scout is a 67 GB download (`llama4:scout` on Ollama), so it is in the same situation as the 70B: too big for 32 GB of RAM.

## What this replaces, and what it does not

For the two jobs you named, a 9B model that answers in a few seconds is enough to stop paying for ChatGPT. It will be weaker than a current hosted frontier model on hard analysis, and it has no web access, so it cannot look up news or a company’s latest numbers. That does not affect a summary of a document you paste in.

Other apps can use the local server instead of OpenAI. Ollama listens on `http://localhost:11434`. Its OpenAI-compatible base URL is `http://localhost:11434/v1`, and the model name to enter is `email`. Any API-key field can be the word `ollama`.
