# Test results

Last run: 2026-09-09 on Linux x86_64 (4 CPU, 16 GB RAM, no NVIDIA GPU).

## Commands

```bash
pytest tests/unit tests/failure tests/integration -q
pytest tests/e2e -q
```

## Results

| Suite | Result |
|---|---|
| Unit | passed |
| Failure / retry | passed |
| Integration (TTS, music, Ken Burns, research, captions) | passed |
| End-to-end sky video | passed — real H.264/AAC MP4 |

## End-to-end artifact

Prompt: “Create a 60-second educational video explaining why the sky appears blue.”

The automated test uses a 28-second cap so CI stays practical; the app honors “60-second” when duration is **AI decides**.

Artifact: `tests/e2e/artifacts/sky-why-blue.mp4` (about 5.3 MB)

Verified with ffprobe after the audio/picture sync fix:

- Video: H.264, 1920×1080, 30 fps, yuv420p, **27.8 s**
- Audio: AAC, **27.8 s** (aligned with picture)
- Executive producer decision: **APPROVE**
- Captions, thumbnails, research JSON, license metadata, SQLite project row all present

## Notes

eSpeak NG narration is synthetic by design (always-available local voice). Piper/Kokoro/Ollama improve quality when installed. No paid API keys were used for these tests.
