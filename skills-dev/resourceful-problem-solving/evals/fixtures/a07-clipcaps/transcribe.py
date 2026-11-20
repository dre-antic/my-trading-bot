"""Local transcription with faster-whisper (see PROJECT_STATE.md for why these settings)."""


def transcribe(audio_path, model_size="small", compute_type="int8"):
    from faster_whisper import WhisperModel

    model = WhisperModel(model_size, device="cuda", compute_type=compute_type)
    segments, _info = model.transcribe(audio_path, word_timestamps=True)
    out = []
    for seg in segments:
        out.append(
            {
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
                "words": [{"start": w.start, "end": w.end, "word": w.word} for w in seg.words],
            }
        )
    return out
