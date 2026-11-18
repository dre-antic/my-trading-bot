"""Speak a script in a cloned voice with Chatterbox (Resemble AI, MIT license).

    .voice-venv/bin/python scripts/clone_voice.py --sample my-voice.wav --text script.txt --out voiceover.wav

The sample should be 10-30 seconds of one person talking clearly, with no music.
Without --sample, Chatterbox's built-in narrator voice is used.
Called by scripts/voiceover.mjs (engines "clone" and "chatterbox").
"""

import argparse
import re
import sys
import time

import torch
import torchaudio as ta


def chunks(text: str, limit: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text).strip())
    out, cur = [], ""
    for s in sentences:
        if cur and len(cur) + len(s) + 1 > limit:
            out.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        out.append(cur)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", help="Reference recording of the voice to clone (omit for the built-in voice)")
    ap.add_argument("--text", required=True, help="Text file with the script")
    ap.add_argument("--out", required=True, help="Output .wav path")
    ap.add_argument("--model", choices=["turbo", "standard"], default="turbo")
    ap.add_argument("--exaggeration", type=float, default=0.5, help="standard model only: 0.25 calm .. 1.0 dramatic")
    ap.add_argument("--cfg", type=float, default=0.5, help="standard model only: lower = slower, more deliberate pacing")
    ap.add_argument("--chunk-chars", type=int, default=260)
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    torch.manual_seed(1234)
    t0 = time.time()
    if args.model == "turbo":
        from chatterbox.tts_turbo import ChatterboxTurboTTS

        model = ChatterboxTurboTTS.from_pretrained(device=device)
    else:
        from chatterbox.tts import ChatterboxTTS

        model = ChatterboxTTS.from_pretrained(device=device)
    print(f"Loaded Chatterbox {args.model} on {device} in {time.time() - t0:.0f}s", flush=True)

    text = open(args.text, encoding="utf-8").read()
    parts = chunks(text, args.chunk_chars)
    gap = torch.zeros(1, int(model.sr * 0.25))
    pieces = []
    for i, part in enumerate(parts):
        t = time.time()
        kwargs = {"audio_prompt_path": args.sample} if i == 0 and args.sample else {}
        if args.model == "standard":
            kwargs.update(exaggeration=args.exaggeration, cfg_weight=args.cfg)
        wav = model.generate(part, **kwargs)
        pieces += [wav.cpu(), gap]
        print(f"  part {i + 1}/{len(parts)} ({len(part)} chars) in {time.time() - t:.0f}s", flush=True)

    ta.save(args.out, torch.cat(pieces, dim=1), model.sr)
    print(f"Wrote {args.out} in {time.time() - t0:.0f}s total", flush=True)


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError as e:
        sys.exit(f"File not found: {e.filename}")
