Keep the local `small` model. Captions are in place, and both upgrades you asked about still fail the limits that already settled this.

`python clipcaps.py episode.mp3` still transcribes on your laptop. It now also writes `episode.srt` beside the audio. Each caption is at most two lines, and each line is at most 42 characters. When the file is a video (`mp4`, `mov`, `mkv`, `webm`, or `m4v`), the same command writes `episode.captioned.mp4` with those captions burned in.

AssemblyAI stays out. Your friend may be right that their latest model is more accurate than Whisper `small`. I did not run a comparison on this show, and the choice does not turn on that. Their pricing page lists pre-recorded transcription at **$0.21 per hour**, with **$50 of starting credit** (November 2026). Using it means [uploading the file to AssemblyAI's servers](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/files/upload). The guest agreements require that unreleased interviews stay on the machine, and the budget is $0 after that credit. [Pricing](https://www.assemblyai.com/pricing).

`large-v3` stays out too. This laptop already ran out of memory on `large-v3` in float16, and on `medium` in float16. The [faster-whisper benchmark](https://github.com/SYSTRAN/faster-whisper) measures the same-size large-v2 model on an RTX 3070 Ti (8 GB): float16 peaks at 4525 MB, int8 at 2926 MB, for 13 minutes of audio. That int8 number is from an otherwise empty 8 GB card and does not include word timestamps. The GTX 1650 has 4 GB, and Windows is already using part of it. The 4525 MB float16 figure matches the out-of-memory run recorded here. `small` in int8 is about 0.3× realtime on this machine, so an hour of audio takes roughly 18 minutes. A large model on this card would be much slower.

The main downside is accuracy: `small` will miss a name more often than a bigger model. If a guest's name keeps coming out wrong, the backup is to try `medium` in int8 on a two-minute sample and stop if it runs out of memory. A cloud model becomes an option only if an episode is already public and the budget changes. A larger Whisper model becomes an option if the GPU has more free memory.

From episode 12's transcript, the caption file starts like this:

```
1
00:00:00,000 --> 00:00:06,110
So today we're talking with Dr. Amara
Okafor about how coral reefs recover

2
00:00:06,160 --> 00:00:11,510
after bleaching events, and honestly
what she told me before we started

3
00:00:11,560 --> 00:00:16,080
recording completely changed
how I think about the ocean.
```

On that sample, all 61 words are kept, no line is over 42 characters, no caption has more than 2 lines, and the times move forward. I burned those captions into a short test video: the frame started black, the caption text was visible afterward, and the audio stream was still there. A phrase can break when it hits 42 characters, which is why "started" and "recording" land on different captions.

Next is choosing the in and out points for a real clip. The caption code can already take a start and end, shift that clip's times to begin at 0, and burn them into the clip video. The burn-in step needs the `ffmpeg` program installed. The `.srt` is still written if that program is missing.
