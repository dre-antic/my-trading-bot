import json
import sys

from transcribe import transcribe


def main(audio_path):
    segments = transcribe(audio_path)
    with open(audio_path + ".segments.json", "w", encoding="utf-8") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)
    print(f"Transcribed {len(segments)} segments")
    # TODO: captions (.srt) and burn-in


if __name__ == "__main__":
    main(sys.argv[1])
