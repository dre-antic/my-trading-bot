# Troubleshooting

## The window does not open

The engine may still be running. Open http://127.0.0.1:8745 in a browser. On Linux, a native window needs GTK webview; the browser UI is fully usable.

## “The video editor (FFmpeg) is missing”

Install FFmpeg, then reopen the app.

- Mac: `brew install ffmpeg` (or use the setup wizard when it can)
- Ubuntu: `sudo apt-get install ffmpeg`

## The voice sounds robotic

That is the built-in eSpeak NG engine, which always works offline. For a more natural voice, install Piper or Kokoro later, or add a cloud TTS key in Settings. The studio will pick them up automatically.

## Research looks thin

Wikipedia may be blocked on your network. The script still runs, but it will mark facts as uncertain instead of inventing them. Check System status and your network.

## A job failed with HTTP 502

The friendly message is: “A generation service is temporarily unavailable. The system will retry automatically.” Open the task, click **Retry**. Local fallbacks run when the cloud is down.

## Not enough disk or memory

The studio classifies your Mac as LOW / MEDIUM / HIGH. Heavy AI video should be sent to a remote GPU. Motion graphics, voice, captions, and editing stay local.

## I closed the app in the middle of a render

Reopen the project. Finished stages are kept. The job continues from the last checkpoint.

## Commercial mode blocked a model

Open **Licenses & models**. If you understand the restriction and still want that model for a personal experiment, switch the project to Personal, or set an explicit override after reading the license. The studio will not do this silently.

## API keys

Never put keys in git. Use Settings. If a key was pasted into a prompt by mistake, rotate it with the provider.

## The test video has no sound

Confirm eSpeak NG is installed (`espeak-ng --version`) and that FFmpeg can encode AAC. Then retry the first-run test.
