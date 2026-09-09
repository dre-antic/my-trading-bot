# Known limitations

- This development environment is **Linux**, not macOS. The engine, UI, tests, and MP4 output were verified here. A signed Apple `.app` must be compiled on a Mac (`scripts/build-macos-app.sh`). The `.app` template and launcher are included.
- Default visuals are **original motion graphics + Ken Burns**, plus Wikimedia stills when licenses allow. FLUX / Wan / LTX / Hunyuan are optional remote providers. They are not downloaded automatically (consumer Macs usually cannot host them).
- Default voice is **eSpeak NG** (robotic, but real TTS). Install Piper or Kokoro for a more natural voice.
- Default music is an **original procedural score**, not ACE-Step, unless you attach that optional GPU service.
- ComfyUI is supported as a remote HTTP server only. This app does not bundle GPL-linked ComfyUI.
- LangGraph was evaluated (MIT, active) and not shipped; orchestration is the in-process checkpoint graph.
- Bright Data was unavailable in this environment (401). Research uses Wikipedia + DuckDuckGo.
- HunyuanVideo and FLUX.1-dev are not used on commercial projects.
- The studio never auto-publishes to YouTube or TikTok.
- Heavy 10–20 minute jobs will take a long time on CPU-only machines. That is expected.
