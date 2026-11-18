---
name: 3d-animated-explainer
description: Create 3D animated explainer videos (money, psychology, history, "what if" niches) with Three.js and Remotion from a script or an uploaded voiceover. Use when the user asks for a 3D animated video, a faceless YouTube/Shorts animation, video ideas or scripts for that style, new character designs, or to render a video in animation-studio/.
---

# 3D animated explainer videos

Everything lives in `animation-studio/` (Remotion 4 + Three.js through `@remotion/three` and React Three Fiber).
A video is a **storyboard**: a voiceover, word-level captions, and a list of timed scenes.
The engine draws the 3D characters, props, charts, captions, transitions, and sound effects.

## Instructions

### 0. One-time setup (skip if `animation-studio/node_modules` exists)

```bash
cd animation-studio
npm install
node scripts/whisper.mjs   # builds whisper.cpp + base.en model into .whisper/ (word timings)
```

Needs Node 18+, FFmpeg, and a C++ compiler. The free draft voice needs `espeak-ng` (`brew install espeak-ng` or `apt install espeak-ng`).
On Linux, if `whisper.mjs` fails with `cannot find -lstdc++`, install `libstdc++-14-dev` (or the version matching the system g++).

### 1. Ideas and script

If the user has no script yet, use `animation-studio/prompts/master-prompt.md` (change `NICHE` when asked for another niche).
Show the 10 ideas, ask which one and how long, then write the script in parts with scene notes.
Save the final script as `animation-studio/src/projects/<id>/script.txt` (plain spoken text, no headings).

### 2. Create the project

```bash
node scripts/new-project.mjs <kebab-id> "Video Title"            # 16:9 long-form
node scripts/new-project.mjs <kebab-id> "Video Title" --vertical # 9:16 Shorts/Reels/TikTok
```

This writes `src/projects/<id>/storyboard.ts` and registers the composition in `src/projects/index.ts`.
The composition id is the PascalCase form of the project id (`money-happiness` → `MoneyHappiness`).

### 3. Voiceover and captions

Pick one:

- **User uploads voiceover files** (ElevenLabs downloads, their own recording). Multiple parts are joined in order:
  `node scripts/transcribe.mjs --project <id> --script src/projects/<id>/script.txt part1.mp3 part2.mp3 part3.mp3`
- **Clone the user's own voice** (they attach a 10-30 second recording, e.g. a phone voice memo `.m4a`, `.mp3`, or `.wav`):
  save it as `animation-studio/voices/<name>.<ext>` (git-ignored, never commit someone's voice), run `bash scripts/setup-voice-clone.sh` once if `.voice-venv/` is missing, then
  `node scripts/voiceover.mjs --project <id> --script src/projects/<id>/script.txt --sample voices/<name>.<ext>`
  This uses [Chatterbox](https://github.com/resemble-ai/chatterbox) (Resemble AI, MIT) locally with no API key. The Turbo model is the default (`--model standard` is slower but has more expressive control).
  On 4 CPU cores it takes about 1.5 s of compute per second of speech. Output carries Resemble's inaudible Perth watermark.
  Only clone a voice the user owns or has permission to use. If they ask to clone someone else's voice (a celebrity, another creator), decline.
  Tell the user what makes a good sample: one speaker, quiet room, no music, natural speaking pace in the tone they want for the video.
- **Generate it here**: `node scripts/voiceover.mjs --project <id> --script src/projects/<id>/script.txt`
  Uses ElevenLabs when `ELEVENLABS_API_KEY` is set (optional `ELEVENLABS_VOICE_ID`, `--voice <id>`). Otherwise it uses Chatterbox's built-in natural narrator voice when `.voice-venv/` exists, and falls back to the robotic eSpeak draft voice. Force one with `--engine clone|chatterbox|elevenlabs|espeak`.
  The ElevenLabs key is only ever sent to `api.elevenlabs.io`. If the user wants ElevenLabs and the key is missing, tell them to add it in Cursor Dashboard → Cloud Agents → Secrets.

Pass `--script` whenever the script text is known: captions then use the exact written words, and whisper only supplies timing.
Both commands write `public/projects/<id>/voiceover.mp3`, `src/projects/<id>/captions.json`, and `src/projects/<id>/timeline.txt`.

### 4. Write the storyboard

Read `timeline.txt` (one sentence per line with `[start - end]` seconds) and give every sentence or pair of sentences a scene.
Scenes run back to back: each scene's `from` is the previous scene's `to`. The last scene should end at or just after the audio.
Aim for a new scene every 2 to 5 seconds. That pace is what makes the style feel alive.

Scene types (full fields in `src/engine/types.ts`):

| type | use for | key fields |
|---|---|---|
| `title` | opening hook | `title`, `subtitle`, `character` |
| `talk` | narration, reactions, dialogue | `characters: CharacterSpec[]` |
| `bigNumber` | a dollar amount, percent, or year | `value`, `prefix`, `suffix`, `label`, `decimals`, `coins` |
| `barChart` | comparing amounts | `bars: {label, value, display?, highlight?}[]` |
| `lineChart` | trends, plateaus, growth | `points`, `markAt`, `markLabel`, `xLabel`, `yLabel` |
| `moneyRain` | wealth, windfalls, spending | `characters` |
| `compare` | A vs B | `left: {label, character}`, `right: {label, character}` |
| `custom` | anything else | `component` key in `customScenes`, `props` |

Every scene also takes `from`, `to`, `headline` (short, uppercase-friendly), `camera`, and `sfx`.

- `CharacterSpec`: `pose`, `mood`, `x` (about -3..3), `z`, `turn` (radians), `style`, `color`, `scale`, `talking`, `tag` (label above head), `prop`.
- Poses: `idle`, `wave`, `point` (auto-aims at the middle of the frame), `pointLeft`, `pointRight`, `shrug`, `cheer`, `think`, `sad`, `walk`, `present`.
- Moods: `neutral`, `happy`, `sad`, `shocked`, `angry`.
- Props: `coin`, `cash`, `moneyBag`, `house`, `heart`, `question`, `lightbulb`.
- Camera: `push` (default), `pull`, `panLeft`, `panRight`, `orbit`, `still`.
- SFX: `whoosh` (played on every scene change by default), `pop`, `ding`, `cash`, `boom`, `tick`. Use `cash` on money reveals, `pop` on labels, `ding` on insights, `boom` on shocking numbers. Set `sfx: []` for silence.
- Storyboard-level: `theme` (`cream`, `night`, `mint`, `sky`, or an object), `characterStyle` (`mannequin`, `stick`, `suit`), `characterColor`.
- The first character in a scene lip-syncs to the voiceover by default. Set `talking: false` on listeners.

See `src/projects/money-happiness/storyboard.ts` for a complete example.

### 5. Custom scenes

When no built-in scene fits, write a component in `src/projects/<id>/scenes.tsx` (see `src/projects/lottery-winners/scenes.tsx`) and register it in the storyboard's `customScenes`. Custom scenes read their settings from `scene.props`.
Build it from `Stage`, `Character`, the props in `src/engine/Props.tsx`, `Headline`, `Tag`, and `projectToScreen`.
Animate only from `useCurrentFrame()` (with `spring` / `interpolate`). Never use `useFrame`, `Math.random()`, timers, or real time: Remotion renders frames out of order and in parallel.

### 6. Preview and render

```bash
npx tsc --noEmit                                                  # type check
npx remotion still <CompositionId> out/check.png --frame=150      # spot-check a frame
npm run studio                                                    # live preview (opens a browser)
npx remotion render <CompositionId> out/<id>.mp4                  # final H.264 MP4
```

Always render 3 to 6 stills across the timeline and look at them before the full render. Check that headlines, tags, and captions don't overlap, characters aren't cut off, and pointing characters face the thing they point at.
`remotion.config.ts` picks the WebGL backend (`angle` on macOS, `swangle` software rendering elsewhere). Set `REMOTION_CONCURRENCY` to limit CPU use.

### 7. Character design options

When the user wants different looks, render `npx remotion still CharacterSheet out/characters.png` and show the image.
To add a new style, extend `CharacterStyle` in `types.ts` and `palette()` in `Character.tsx` (body colors, limb thickness, accents), then re-render the sheet.

## Examples

- "Make me a 3D animated video about why people stay broke": run the master prompt, write the script, create the project, generate the voiceover, write the storyboard, render stills, render the MP4.
- "Here are my 3 ElevenLabs voiceover parts" (attached mp3s): run `transcribe.mjs` with all parts in order plus `--script`, then storyboard and render.
- "Use my voice" plus an attached voice memo: save it under `voices/`, run the setup script if needed, then `voiceover.mjs --sample voices/<file>`.
- "Make it a YouTube Short": create the project with `--vertical`. Keep scenes to 1 or 2 characters and short headlines.
- "Show me other character styles": render the `CharacterSheet` still.

## Performance Notes

- Rendering uses software WebGL on machines without a GPU. On 4 CPU cores at 1080p it measured about 10 frames per second (the 35-second example renders in under 2 minutes), so a 6-minute video takes roughly 20 minutes. Render a stills check first.
- Only one scene's 3D canvas is mounted at a time, so long videos don't use more memory than short ones.
- whisper `base.en` transcribes a 6-minute voiceover in about a minute. Set `WHISPER_MODEL=small.en` for better accuracy on hard words.

## Troubleshooting

- **Black or empty 3D scene in renders**: the WebGL backend failed. Try `--gl=swangle` (no GPU) or `--gl=angle` (GPU).
- **Captions out of sync**: re-run `transcribe.mjs` after editing audio. Scene `from`/`to` values must come from the new `timeline.txt`.
- **Wrong words in captions**: pass `--script` so captions use the written text.
- **`Audio prompt must be longer than 5 seconds`**: the voice sample is too short after leading silence is trimmed. Ask for a longer recording.
- **`'NoneType' object is not callable` from `perth`**: run `.voice-venv/bin/pip install "setuptools<81"` (the watermark package needs `pkg_resources`).
- **Cloned voice sounds off**: try a cleaner or longer sample, or `--model standard`.
- **`Custom scene "x" is not registered`**: add the component to `customScenes` in the storyboard.
- **Fonts look like a fallback**: the Montserrat font downloads from Google Fonts at render time and needs internet access.
