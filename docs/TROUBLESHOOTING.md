# Troubleshooting

## The UI says "ui not built"

In development use `npm run dev` (API + Vite). `npm start` serves `web/dist` after `npm run build`.

## No speech, only a tone

Install eSpeak NG:

```bash
# Debian/Ubuntu
sudo apt-get install espeak-ng
# macOS
brew install espeak-ng
```

Aether falls back to a timing tone if TTS binaries are missing so the video still renders.

## FFmpeg errors / black video

Need a recent FFmpeg 4.4+ with libx264 and AAC. Check:

```bash
ffmpeg -version
espeak-ng --version
```

On very old Macs keep **Quality = draft** (720p, 24fps, `veryfast`). Close other browsers while rendering.

## Job stuck in `running` after a crash

Restart the API. `resumeIncomplete()` continues from the last completed stage in `manifest.json`. Delete `projects/<id>` only if you want a hard reset.

## Provider 401 / quota

The registry marks the provider unavailable and fails over (heuristic LLM, procedural graphics, eSpeak). Add keys in Settings. Paid failover never runs if `ALLOW_PAID_PROVIDERS=false`.

## Pixabay 429

Results are cached 24h as required. Wait for the window or rely on Wikimedia / procedural graphics.

## "Paid providers are disabled"

Expected. Set `ALLOW_PAID_PROVIDERS=true` and a budget in `.env` only if you intend to spend money. The UI will still require approval above `REQUIRE_APPROVAL_ABOVE_COST`.

## Demo vs production

`DEMO_MODE=true` forces mock/heuristic LLM so you can test without quota. Turn it off when Groq (or another LLM) is configured. `OFFLINE_MODE=true` skips network research/stock entirely.

## Remotion

Not used. Do not `npm install remotion` unless you have read `docs/LICENSES.md` and have RAM to spare.

## Ports

- `8787` API  
- `5173` Vite dev UI (proxies `/api`)
