Use **[Rescript](https://github.com/wassgha/rescript)** for a hobby podcast. It is the free, local app that actually covers the three Descript jobs on your machine: it transcribes on the laptop, cuts the audio when you delete words, and removes fillers such as “um” and “uh” in one click. It also shortens dead air, labels speakers, and exports WAV, MP3, or M4A.

Your 16 GB of RAM and GTX 1650 (4 GB) are enough for it. Install the Windows desktop build, transcribe with **Whisper Small**, and do the final loudness pass in free **Audacity**.

Current Rescript (v1.2.5, October 29, 2026) is under the [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0) license. A hobby show with no anticipated commercial use fits that. A show that earns money (ads, sponsors, a paid feed, paid memberships) does not. That is a license question, not legal advice; if the show earns money, use TalkCut below, or ask the Rescript author about a commercial license.

## Hobby show: Rescript

1. Download the Windows installer from the [v1.2.5 release](https://github.com/wassgha/rescript/releases) (`Rescript-Setup.exe`) or from [getrescript.com’s Windows download](https://www.getrescript.com/download?platform=windows). The same editor also runs in a Chromium browser at [app.getrescript.com](https://app.getrescript.com/). The desktop app is the better daily driver.
2. Update the NVIDIA driver first. Rescript runs Whisper in the browser engine with WebGPU, and falls back to the CPU if WebGPU is missing. The 1650 can run the models Rescript offers (Base and Small). Small is the one to use.
3. Drop in the episode. Record and keep a WAV. The first transcription downloads the model (Base is on the order of 85 MB; Small is larger) and caches it. After that, transcription and editing stay on the machine.
4. Click **Remove fillers**, then read the transcript and delete tangents, restarts, and any “um” the transcript still shows. Press Delete on selected words; playback skips those spans. Speaker labels come from a local pyannote model, which helps on interviews.
5. Listen through once before you export. Word times are a little loose, and you can drag a cut edge when a syllable gets clipped. **Remove silences** cuts pauses of 0.3 seconds or longer. On a conversation that can sound chopped, so preview it and undo it if the rhythm dies. Whisper also tends to omit fillers, so the one-click pass only removes “um”s that made it into the text. Anything it cleaned up has to be cut by ear.
6. Export **WAV** from the desktop app. In **Settings → Privacy**, turn off the anonymous usage and crash reporting if you do not want it. It is on by default and does not upload the episode.

Free DaVinci Resolve does not include this. Audio transcription and text-based editing are Studio-only.

## If the show makes money: TalkCut

**[TalkCut](https://github.com/iamspyder/talkcut)** is MIT-licensed, offline, and built for the same workflow. The Windows app is real: v1.0.3 (October 18, 2026), `TalkCut-Windows-x64.exe` on the [releases page](https://github.com/iamspyder/talkcut/releases/latest).

It transcribes with whisper.cpp (base, small, or medium), lets you delete words to cut the media, and has a cleanup preview for fillers, long gaps, and adjacent repeated takes. **Studio Sound** is local DeepFilterNet noise cleanup plus loudness normalization, with a before/after listen. Export includes MP3. No account and no watermark. Optional cloud AI (OpenAI, fal, ElevenLabs) stays off unless you turn it on.

It is a young project: a couple of stars and a few dozen Windows downloads, and the installer is unsigned. Windows SmartScreen will warn. Check the SHA-256 on the GitHub release, then More info → Run anyway. Run one full episode and listen before you switch the show over. Its own notes say long-recording performance is still on the roadmap, and retake detection only catches obvious adjacent repeats.

On 16 GB, use the **small** model (about 488 MB). The project recommends 16 GB or more for medium (about 1.53 GB) and for 4K. Medium will fit if you close browsers and other heavy apps; small is the comfortable default. TalkCut’s normal transcription path is the CPU, so the 1650 sits idle and a full episode takes a while. That is a batch job, not a live one.

**[Strikecut](https://github.com/Naazimsnh02/strikecut)** (MIT, v0.1.0, October 12, 2026) is the other local option worth one test episode. It is the tool that specifically tries to keep “um” and “uh” in the transcript (Whisper is prompted to be verbatim) and it **shortens** long pauses to 1.0, 0.6, or 0.3 seconds instead of deleting every gap. Cuts snap to the nearest quiet point so they are less likely to land mid-syllable. Windows builds exist (`Strikecut_0.1.0_x64-setup.exe` and an MSI), also unsigned, and almost unused so far. Its examples are video files, so confirm your WAV or MP3 imports; TalkCut and Rescript are the ones that document audio and MP3 export directly. There is a CLI (`strikecut clean episode.mp4 --max-pause 0.5`) if you would rather script it.

## What to expect from this PC

- **Model.** Whisper Small. Base is faster and will mangle names. The large Whisper models want more than 4 GB of video memory; Faster-Whisper’s GPU path is aimed at cards with about 6 GB. Your 1650 should run Rescript’s Small model on WebGPU. If a transcription dies with a GPU memory error, switch to Base.
- **Memory.** 16 GB is enough for one episode with Small, with other heavy apps closed. Export and transcription both hold the audio in memory.
- **Disk.** Leave several GB free for the model, the project cache, and a WAV export.
- **GPU.** It speeds up Rescript when WebGPU is active. TalkCut and Strikecut, as shipped, transcribe on the CPU. You do not need to build a CUDA whisper.cpp yourself for this workflow.

## Finish in Audacity

None of these replace a normal podcast master. After the text edit, open the WAV in [Audacity](https://www.audacityteam.org/):

- High-pass and a light noise reduction or compression if the room needs it.
- Loudness Normalization toward the usual spoken-word target, about **−16 LUFS** for stereo (about **−19 LUFS** for mono) and a true peak around **−1 dBTP**.
- Export the publish file once, as MP3 or AAC. Starting from WAV means that encode is the only lossy step.

If room noise is the main problem, Intel’s free [OpenVINO AI plugins for Audacity](https://github.com/intel/openvino-plugins-ai-audacity) add Whisper transcription and DeepFilterNet noise suppression. Those run on the CPU. They produce a label track, so cutting from that track is manual. They are a denoise tool, not a Descript stand-in.

## What you still do by hand

These apps do not do Descript Overdub, so you cannot rewrite a sentence in a cloned voice. Overlapping speech will confuse both the transcript and the cuts; edit a clean mix, or edit each guest on their own track. After every automatic filler or silence pass, listen once. A cut that looks right in the text can still clip a breath or leave half an “um”.
