Install the **Rescript** desktop app. It transcribes each episode on your laptop, cuts the audio when you delete words, and has a button that removes “um,” “uh,” and the same kind of filler. No subscription and no account. The recording stays on the machine.

On your GTX 1650 (4GB), choose the **Parakeet v3** model. That model is built to use about 1.3GB of video memory, so it fits this card. You have 16GB of RAM, which covers the automatic CPU fallback if the graphics card resets mid-episode (a Windows screen lock can do that). The app then reloads and keeps going.

## Why this one

Rescript is the maintained Windows app that already does the whole job: local transcription, text editing that edits the audio, one-click filler removal, pause cutting, and an audio export. The current release is **v1.2.5** (29 Oct 2026).

- Installer: [github.com/wassgha/rescript/releases/latest](https://github.com/wassgha/rescript/releases/latest) — the Windows file is `Rescript-Setup.exe`
- Same download from the project site: [getrescript.com/download?platform=windows](https://www.getrescript.com/download?platform=windows)

The filler button is a real list in the app (um, uh, hmm, and the same sounds in a few other languages). It leaves ordinary words such as “like” and “so” alone, so a sentence stays intact. Delete those yourself when you actually want them gone. Hesitations the transcript skips are marked, and that same button can cut them. Export WAV, MP3, or M4A.

A Windows user with long files had Whisper Small die around the 15-minute mark after a GPU reset, and Parakeet v3 finished the file. That is why Parakeet is the model for your episodes. Whisper Base (about 200MB) is the lighter retry if Parakeet fails.

## What to do

1. Install `Rescript-Setup.exe` and use the desktop app for full episodes.
2. In Settings, turn off usage and crash reporting if you want the app to stop phoning home. The first transcription still downloads the model once.
3. Update the NVIDIA driver if transcription never starts or crawls. Close games and OBS while it runs so the 4GB card is free.
4. Drop in one episode and select **Parakeet v3**. English and most European languages are the languages that model is aimed at.
5. Use the filler button, then delete any other words or sentences. Playback skips those cuts. If a cut clips the start or end of a word, drag that word’s edges.
6. Export **WAV** as the master, then make your usual podcast MP3 from that. Keep the original recording.

Listen through that export once. These models still mis-hear names and sometimes drop or invent a short word. If the transcript stops halfway, run that file again on **Whisper Base**.

## Watch out for

**License.** Since 31 Jul 2026 the current app has been under the PolyForm Noncommercial license. A hobby show with no ads, sponsors, or paid memberships fits. A show that makes money, or that you plan to monetize, does not. The author offers a commercial license. The free stand-in is below.

**It is a young app.** It started in July 2026. It has had steady releases since, including fixes for long files, Windows GPU resets, and memory. Keep your original recordings anyway.

**Heavier Whisper models do not fit a session like this.** Stay on Parakeet v3 for episodes.

## If Rescript is the wrong fit

If the show earns money, or a full episode fails in Rescript, use **Strikecut**: [github.com/Naazimsnh02/strikecut/releases/latest](https://github.com/Naazimsnh02/strikecut/releases/latest) (`Strikecut_0.1.0_x64-setup.exe`). It is free under MIT, transcribes on the PC with whisper.cpp, cuts audio when you delete words, and removes fillers in one click. The current build is 0.1.0 from 12 Oct 2026, with almost no users, and Windows may warn because the installer is unsigned. For a real episode, switch the model to **small.en**. The default download is the smaller, weaker one. Transcription uses the CPU. 16GB is enough, and a long episode will take a while. Run one episode as a test and keep the masters.

If you want a tool with years of support and you can pay once, **DaVinci Resolve Studio** is US$295, or US$236 through 20 Nov 2026 on the sale Blackmagic announced on 20 Oct 2026. Transcription and editing from the transcript are Studio features. Removing an “um” there means searching the transcript and deleting those words. The free Resolve download leaves that out.

Recut is a solid one-time silence remover for Windows, and its homepage now also describes transcript editing. Its changelog through v4.5.6 (6 Nov 2026) still has no transcription entry, and Recut’s own TimeBolt comparison page still says it cannot remove ums and uhs. I would not buy it for this job until a changelog entry shows that feature shipped.

I’ll assume the show is in English and takes no ads, sponsors, or listener payments. If the language is outside Parakeet’s European set, use Whisper Small in Rescript. If the show earns money, start with Strikecut instead.
