Keep transcription on this laptop with faster-whisper `small` and `int8`. Captions are in now.

**AssemblyAI.** A bigger cloud model can be more accurate than Whisper small. This project still can't use it. AssemblyAI is a paid API, and sending it an episode uploads the audio. The budget is $0, and the guest agreements say unreleased interviews stay on your machine. That decision from October still stands.

**large-v3.** Leave the model at `small` / `int8`. On this GTX 1650 (4 GB), `large-v3` in float16 already died with CUDA out of memory, and `medium` in float16 did too. `small` in `int8` is the setting that finishes an episode, at about 0.3× realtime. `transcribe.py` is unchanged.

**Captions.** `python clipcaps.py episode.mp3` still transcribes, and it now also writes `episode.srt` next to the audio. Each caption is at most 2 lines, and each line is at most 42 characters. Times come from the word timestamps. "Dr." is kept with the name that follows it, instead of being treated as the end of a sentence.

For one clip, rebuild from the transcript you already have (no second GPU pass):

```
python clipcaps.py --srt episode.mp3.segments.json --start 90 --end 130 --out clip.srt
```

Times in that file start at 00:00:00, so they line up with a trimmed clip.

Burn them into the video (ffmpeg has to be on PATH):

```
python clipcaps.py --burn clip.mp4 clip.srt
```

That writes `clip.captioned.mp4`. White text, dark outline, centered along the bottom.

Episode 12's opening comes out like this:

```
1
00:00:00,000 --> 00:00:05,150
So today we're talking
with Dr. Amara Okafor about how coral

2
00:00:05,200 --> 00:00:10,160
reefs recover after bleaching events,
and honestly what she told me

3
00:00:10,210 --> 00:00:16,080
before we started recording completely
changed how I think about the ocean.

4
00:00:16,530 --> 00:00:18,700
Amara, thanks for coming on.

5
00:00:19,150 --> 00:00:22,160
Thanks for having me, it's a pleasure.

6
00:00:22,610 --> 00:00:24,780
Let's start with the basics:

7
00:00:25,230 --> 00:00:29,650
what actually happens to a coral
during a marine heatwave?
```

I checked those rules against the sample transcript (every word kept, no line over 42 characters, no caption over 2 lines, clip times starting at zero) and burned that opening onto a 1080×1920 test video. The lines sit at the bottom, fully on screen.

Next piece, when you want it, is choosing the clip in/out points and cutting the vertical video. The burn step is ready for that file.
