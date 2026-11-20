# Animation Studio

3D animated explainer videos built with [Three.js](https://threejs.org) and [Remotion](https://www.remotion.dev): simple 3D characters, animated numbers and charts, falling coins, word-by-word captions, sound effects, and your voiceover. Rendered to MP4 entirely from code, without paid AI video generators.

The workflow follows the "viral 3D animation videos with Claude Code" method, adapted for Cursor:

1. Generate ideas and a script with the [master prompt](prompts/master-prompt.md).
2. Record the voiceover (ElevenLabs or any recording), or generate a draft voice locally.
3. Ask the agent to animate it. The agent follows the skill in `.cursor/skills/3d-animated-explainer/SKILL.md`.
4. Render the MP4.

## Setup

```bash
cd animation-studio
npm install
node scripts/whisper.mjs   # one time: whisper.cpp for word-level caption timing
```

Requirements: Node 18+, FFmpeg, a C++ compiler (for whisper.cpp). Optional: `espeak-ng` for the free draft voice, `ELEVENLABS_API_KEY` for a natural voice.

## Make a video

```bash
node scripts/new-project.mjs why-people-stay-broke "Why People Stay Broke"
# either: your own voiceover parts
node scripts/transcribe.mjs --project why-people-stay-broke --script script.txt part1.mp3 part2.mp3
# or: generate one
node scripts/voiceover.mjs --project why-people-stay-broke --script script.txt
# then write src/projects/why-people-stay-broke/storyboard.ts using timeline.txt
npx remotion render WhyPeopleStayBroke out/why-people-stay-broke.mp4
```

### Use your own cloned voice

Record 10-30 seconds of yourself talking (a phone voice memo is fine: one speaker, quiet room, no music), then:

```bash
bash scripts/setup-voice-clone.sh   # one time, installs Chatterbox (MIT) into .voice-venv/
node scripts/voiceover.mjs --project why-people-stay-broke --script script.txt --sample voices/me.m4a
```

Cloning runs locally with [Chatterbox](https://github.com/resemble-ai/chatterbox) and needs no API key. The `voices/` folder is git-ignored. Only clone voices you have permission to use.

`npm run studio` opens the Remotion preview. `npx remotion still CharacterSheet out/characters.png` shows every character style.

## Layout

```
src/engine/       Character rig, props, scenes, captions, camera, themes
src/projects/     One folder per video: storyboard.ts, captions.json, timeline.txt, script.txt
public/projects/  Voiceover audio per video
public/sfx/       Built-in sound effects (regenerate with `node scripts/sfx.mjs`)
prompts/          Master prompt for ideas and scripts
scripts/          new-project, voiceover, transcribe, sfx, whisper setup
```

The included example, `MoneyHappiness`, is a 35-second video about the "$75,000 happiness plateau". It uses the eSpeak draft voice. Swap in an ElevenLabs voiceover with `transcribe.mjs` for a natural voice.
