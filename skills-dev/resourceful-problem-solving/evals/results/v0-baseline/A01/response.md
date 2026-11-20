The key belongs in a Netlify environment variable, read only by a Function. A key pasted into page JavaScript ships in the file every visitor downloads, so it shows up in View Source, the Network panel, and any copy of the bundle. Scanners look for that constantly, and a leaked OpenAI key gets spent.

A static site can still call OpenAI. The browser calls your Function; the Function calls OpenAI.

## 1. Put the key on Netlify

In the Netlify UI: **Site configuration → Environment variables → Add a variable**.

- Key: `OPENAI_API_KEY`
- Value: your secret key
- Scope: **Functions** (on plans that let you scope variables)

Values written in `netlify.toml` are not available to Functions. After you add or change the variable, trigger a new deploy so the Function picks it up.

For local runs, put the same line in a `.env` file at the project root and add `.env` to `.gitignore`. `netlify dev` loads it. The file never gets committed.

## 2. Function

Create `netlify/functions/openai.js`:

```js
export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20) {
    return Response.json(
      { error: "messages must be an array of 1–20 items" },
      { status: 400 },
    );
  }

  for (const message of messages) {
    const roleOk =
      message?.role === "user" ||
      message?.role === "assistant" ||
      message?.role === "system";
    const contentOk =
      typeof message?.content === "string" &&
      message.content.length > 0 &&
      message.content.length <= 4000;
    if (!roleOk || !contentOk) {
      return Response.json(
        { error: "Each message needs a role and short string content" },
        { status: 400 },
      );
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not set on the Function" },
      { status: 500 },
    );
  }

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages,
      max_completion_tokens: 500,
    }),
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = { path: "/api/openai" };
```

The model name and token cap are fixed inside the Function. Swap `gpt-5-mini` for whatever current model id you want; the browser cannot change it. With `path` set, the route is `/api/openai` both locally and in production, and the default `/.netlify/functions/openai` URL is not also published.

## 3. Browser fetch

```js
async function ask(prompt) {
  const response = await fetch("/api/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || data.error || `Request failed (${response.status})`);
  }
  return data.choices?.[0]?.message?.content ?? "";
}
```

That script contains no secret. Deploy, then call `ask("Hello")` from the page.

## The Function is still public

Anyone who can load the site can POST to `/api/openai` and use your quota, up to the limits above. For a personal page that is often enough. If the page is public and you want a tighter gate, turn on Netlify’s rate limiting for that path, or check a login before the OpenAI call.

Docs used for the Function shape and env access: [Environment variables and serverless functions](https://docs.netlify.com/build/functions/environment-variables) and [Function configuration](https://docs.netlify.com/build/functions/configuration/).
