# Project state: clipcaps (podcast clip captioner)

## Goal
Turn 60-minute podcast episodes into short vertical clips with burned-in captions, for free, on the owner's laptop.

## Constraints
- $0 budget: no paid APIs or subscriptions.
- Windows laptop, GTX 1650 (4 GB VRAM), 16 GB RAM.
- Owner is non-technical; runs `python clipcaps.py episode.mp3`.
- Episodes contain unreleased guest interviews: audio must not be uploaded to third-party services before release (guest agreements).

## Decisions
- 2026-10-02 Transcription: faster-whisper locally, model `small`, compute_type `int8`. Why: free, private, fits 4 GB.
- 2026-10-02 Rejected cloud speech APIs (AssemblyAI, Deepgram, OpenAI): cost, and they require uploading unreleased audio.
- 2026-10-05 Rejected whisper `large-v3` locally: see failed attempts.

## Failed attempts
- 2026-10-05 `large-v3` float16: CUDA out of memory on 4 GB. `medium` float16: out of memory. `small` int8 works (~0.3x realtime).

## Status
- `transcribe.py` works and returns segments with word timestamps (see `sample_segments.json` for real output from episode 12).

## Next
- Captions: generate an .srt per clip (max 42 characters per line, max 2 lines per caption), then burn in with ffmpeg.
