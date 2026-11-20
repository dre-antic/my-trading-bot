Put the OpenAI call in a Netlify Function and keep the key in a Netlify environment variable. A key inside the site's JavaScript is visible to anyone who opens the file or the browser's network tools. They can spend your credit on your account, and [OpenAI disables keys it finds in public pages or client apps](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety).

The browser only talks to your own site. The function, on the server, is what calls OpenAI.

If this key has already been in the page or in a repository, revoke it in the OpenAI dashboard and create a new one for the steps below.

## Layout

Keep the function outside the folder Netlify publishes, or the function file is served as a static file:

```text
public/index.html
netlify/functions/ask.mjs
netlify.toml
```

`netlify.toml`:

```toml
[build]
  publish = "public"
```

Do not put the key in `netlify.toml`. Variables declared there are not available to functions.

## The function

`netlify/functions/ask.mjs` — this is the only place that calls OpenAI:

```javascript
const MODEL = "gpt-6.2-astra";
const MAX_MESSAGE_CHARS = 2000;

export default async (req) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY is not set on the server." }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return json({ error: "Add a message." }, 400);
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return json(
      { error: `Message must be ${MAX_MESSAGE_CHARS} characters or fewer.` },
      400,
    );
  }

  const openaiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: "low" },
      max_output_tokens: 2000,
      store: false,
      input: message,
    }),
  });

  const data = await openaiRes.json().catch(() => null);
  if (!openaiRes.ok) {
    const detail = data?.error?.message || "OpenAI request failed.";
    return json({ error: detail }, 502);
  }

  const text = readOutputText(data);
  if (!text) {
    const reason = data?.incomplete_details?.reason;
    return json(
      {
        error:
          reason === "max_output_tokens"
            ? "The model used its token budget before it finished a reply."
            : "The model returned no text.",
      },
      502,
    );
  }

  return json({ text });
};

function readOutputText(data) {
  const parts = [];
  for (const item of data?.output ?? []) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        parts.push(part.text);
      }
    }
  }
  return parts.join("");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config = {
  path: "/api/ask",
  method: "POST",
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
```

The model id is the one in [OpenAI's current text-generation guide](https://developers.openai.com/api/docs/guides/text). Change `MODEL` if you want a different one. The function chooses the model itself, so a visitor cannot turn this URL into an open proxy. `store: false` tells OpenAI not to keep the response. The rate limit is Netlify's built-in per-visitor cap: 10 requests per minute from one IP, then HTTP 429. That cap can take up to about 10 seconds to start blocking, and it does not cap total spend across all visitors.

## The page

`public/index.html` — no key, no OpenAI URL:

```html
<form id="ask">
  <label>
    Message
    <textarea name="message" maxlength="2000" required></textarea>
  </label>
  <button type="submit">Ask</button>
  <p id="reply"></p>
</form>
<script>
  const form = document.querySelector("#ask");
  const reply = document.querySelector("#reply");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    reply.textContent = "Thinking…";

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: new FormData(form).get("message") }),
      });
      const data = await res.json();
      reply.textContent = res.ok ? data.text : data.error || "Request failed.";
    } catch {
      reply.textContent = "Could not reach the site.";
    }
  });
</script>
```

## Turn it on

1. In the Netlify UI, add an environment variable named `OPENAI_API_KEY`. Include the Functions scope, and mark it as containing a secret. A new deploy is required before the function can see a new or changed value. [Netlify's function environment-variable docs](https://docs.netlify.com/build/functions/environment-variables).
2. Deploy the project (the `public` folder plus `netlify/functions`), not only the HTML.
3. In the OpenAI project settings, set a usage limit before the page is public. The function URL is still on the internet, so a limit there is what stops a large bill. `gpt-6.2-astra` is a reasoning model: it can spend tokens before it shows any text, and a synchronous function stops at 60 seconds. If replies come back as "used its token budget," raise `max_output_tokens`.

To try it locally, link the site and run `netlify dev`, which serves the page and `/api/ask` together. Keep any local `.env` out of git.

I'll assume a single message and a single reply, and the model `gpt-6.2-astra`, unless you say otherwise. If you want earlier turns sent back each time, or a specific model id, say which.
