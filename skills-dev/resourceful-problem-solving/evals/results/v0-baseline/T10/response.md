The tutorial is out of date in three places. Here is a setup that still gives you a React frontend, a Flask API, and Coqui-style text-to-speech, using the tools that actually work now.

I assumed English, one built-in voice, and that you want it running on your own machine first. Questions that would change the later steps are at the end.

## What to change from the tutorial

- **Frontend.** Start with Vite. The React team deprecated Create React App for new apps on 14 February 2025 ([sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)). `npx create-react-app` still runs, and it prints a deprecation warning.
- **Speech package.** Install `coqui-tts`. The original `TTS` package on PyPI had its last release in December 2023, only supports Python below 3.12, and is unmaintained. The maintained fork is [`coqui-tts`](https://coqui-tts.readthedocs.io/en/latest/faq.html), from the Idiap continuation of the project. The two packages cannot be installed in the same environment.
- **Host.** Heroku has no free tier. Free dynos, free Postgres, and free Redis ended on 28 November 2022 ([Heroku changelog](https://devcenter.heroku.com/changelog-items/2502)). The cheapest dyno today is Eco at $5/month for a shared pool of 1,000 hours, and it has 512 MB of RAM ([dyno sizes](https://devcenter.heroku.com/articles/dyno-sizes)). Basic ($7) and Standard-1X ($25) are also 512 MB. PyTorch plus a speech model will not run in 512 MB. The first Heroku size with enough memory is Performance-M: 2.5 GB at $250/month. That is a poor fit for this project.

Run the API locally while you build the side project. Put the React app on a free static host later. Put the API on a machine with at least a few gigabytes of RAM when you need it online.

## 1. Tools to install

- Node.js 20 or 22 (includes npm)
- Python 3.11 (any Python from 3.10 up to, and not including, 3.15 matches the current Coqui docs)
- A C compiler is pulled in with the audio library below

On Ubuntu or Debian:

```bash
sudo apt-get update
sudo apt-get install -y espeak-ng libsndfile1-dev
```

On macOS: `brew install espeak-ng`. `espeak-ng` is what the phoneme models call. `libsndfile` is what the audio code reads and writes. The project’s own Docker image installs both.

## 2. Frontend

```bash
mkdir side-project && cd side-project
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173`.

Point the dev server at the Flask API so the browser can call `/api/...` without a cross-origin setup. Replace `frontend/vite.config.js` with:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5000",
    },
  },
});
```

Replace `frontend/src/App.jsx` with a small form that posts text and plays the WAV it gets back:

```jsx
import { useState } from "react";

export default function App() {
  const [text, setText] = useState("Hello from the side project.");
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function speak(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (audioUrl) URL.revokeObjectURL(audioUrl);

    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${response.status})`);
      }
      const blob = await response.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err.message);
      setAudioUrl("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Speak</h1>
      <form onSubmit={speak}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
        />
        <button type="submit" disabled={busy || !text.trim()}>
          {busy ? "Generating…" : "Speak"}
        </button>
      </form>
      {error ? <p>{error}</p> : null}
      {audioUrl ? <audio src={audioUrl} controls autoPlay /> : null}
    </main>
  );
}
```

## 3. Flask API and Coqui

From `side-project`:

```bash
mkdir backend && cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install torch torchaudio
python -m pip install coqui-tts flask flask-cors
```

Install PyTorch before `coqui-tts`. Since `coqui-tts` 0.27.4, the package no longer depends on PyTorch being bundled ([installation](https://coqui-tts.readthedocs.io/en/latest/installation.html)). The docs prefer `uv` for this; the commands above are the same steps with pip. If a later import error names `torchcodec`, install that too (`pip install torchcodec`). It is required with PyTorch 2.9 and newer.

If a previous attempt left the old package around, remove it before installing the fork. They conflict:

```bash
pip uninstall TTS trainer coqpit
pip cache purge
pip install coqui-tts
```

Create `backend/app.py`:

```python
import os
import tempfile

import torch
from flask import Flask, after_this_request, request, send_file
from flask_cors import CORS
from TTS.api import TTS

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

device = "cuda" if torch.cuda.is_available() else "cpu"
# Single-speaker English VITS. Smaller and simpler than XTTS.
# The downloader prints this model's license on first use.
tts = TTS("tts_models/en/ljspeech/vits").to(device)


@app.post("/api/speak")
def speak():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return {"error": "text is required"}, 400
    if len(text) > 500:
        return {"error": "keep text under 500 characters"}, 400

    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    tts.tts_to_file(text=text, file_path=path)

    @after_this_request
    def cleanup(response):
        try:
            os.remove(path)
        except OSError:
            pass
        return response

    return send_file(path, mimetype="audio/wav")
```

The model name and the `TTS("...").tts_to_file(...)` call match the current inference docs ([synthesizing speech](https://coqui-tts.readthedocs.io/en/latest/inference.html)). `tts_models/en/ljspeech/vits` is one voice, English, and it does not need a separate vocoder. List everything available with `tts --list_models`.

Start it:

```bash
flask --app app run --port 5000
```

The first request is slow. Coqui downloads the checkpoint into `~/.local/share/tts` on Linux, `~/Library/Application Support/tts` on macOS, or `%LOCALAPPDATA%\tts` on Windows. Later requests reuse that copy. CPU synthesis of a short sentence usually takes a few seconds once the model is loaded.

Quick check, with the API already running:

```bash
curl -X POST http://127.0.0.1:5000/api/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from Flask."}' \
  --output hello.wav
```

Then load `http://localhost:5173`, submit the form, and confirm the audio element plays.

## 4. Model choice and license

Stay on `tts_models/en/ljspeech/vits` until the app works. For other English voices, `tts_models/en/vctk/vits` is multi-speaker: pass `speaker="p225"` (or another id from `tts.speakers`) into `tts_to_file`.

Read the license line printed when a model downloads, before you ship anything. Model licenses differ. XTTS (`tts_models/multilingual/multi-dataset/xtts_v2`) is the multilingual voice-cloning model, and Coqui released it for non-commercial use. It is also much heavier and wants a GPU. The library code itself is MPL-2.0.

Load the model once at process start, as in `app.py`. Give that process a few gigabytes of RAM. One Gunicorn worker is the right production setting, because every worker loads its own copy:

```bash
pip install gunicorn
gunicorn --workers 1 --timeout 120 app:app
```

The timeout is there because the first synthesis, and CPU synthesis of longer text, can outlast Gunicorn’s default 30 seconds.

## 5. When you want it online

Split the two parts.

**Frontend.** `npm run build` writes static files to `frontend/dist`. Cloudflare Pages, Netlify, or GitHub Pages can host that directory. Set the API origin the page should call. The Vite proxy exists only for `npm run dev`. In production, either call an absolute API URL or put both on one domain and reverse-proxy `/api` to Flask.

**API.** Keep this off Heroku. A small VPS with 4 GB of RAM is the practical host: install the same system packages, the same venv, and run the Gunicorn command above behind Caddy or Nginx with HTTPS. The model cache has to live on persistent disk, or every restart downloads it again.

Hugging Face Spaces has a free CPU Basic shape (2 vCPU, 16 GB RAM), which is large enough. Creating a Gradio or Docker Space currently requires a paid Hugging Face plan; a free personal account can host up to two ZeroGPU Gradio Spaces ([Spaces overview](https://huggingface.co/docs/hub/spaces-overview)). Check that page again when you are ready to deploy, because that policy is recent.

## A few things the tutorial will not warn you about

- The first run needs a network path to download the checkpoint, and a couple of gigabytes of free disk.
- Synthesis holds the Python process. One request at a time is the realistic local setup.
- Keep the 500-character cap, or raise it knowingly. Long text on CPU can take a long time and hold the single worker.
- Add your real frontend origin to `CORS(...)` once it has a public URL.

If you say which operating system you are on, whether you need more than one voice or voice cloning, and whether this has to be reachable from the public internet, the hosting and model steps can be narrowed to one concrete path.
