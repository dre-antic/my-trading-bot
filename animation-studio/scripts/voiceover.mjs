#!/usr/bin/env node
// Generate a voiceover from a script text file, then produce word-level captions.
//
//   node scripts/voiceover.mjs --project my-video --script path/to/script.txt [--voice <elevenlabs voice id>]
//   node scripts/voiceover.mjs --project my-video --script path/to/script.txt --sample my-voice.m4a
//
// Engines, picked in this order unless --engine is given:
//   clone       --sample (or VOICE_SAMPLE) is set: your own voice, cloned locally with Chatterbox (scripts/setup-voice-clone.sh)
//   elevenlabs  ELEVENLABS_API_KEY is set
//   chatterbox  Chatterbox is installed: its built-in natural narrator voice, local and free
//   espeak      free robotic draft voice
// Either way the result goes through scripts/transcribe.mjs.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ffmpeg, parseArgs, projectPaths, ROOT} from './lib.mjs';

const {flags} = parseArgs(process.argv.slice(2));
if (!flags.project || !flags.script) {
	console.error('Usage: node scripts/voiceover.mjs --project <id> --script <script.txt> [--sample <recording>] [--voice <voice id>] [--engine clone|chatterbox|elevenlabs|espeak]');
	process.exit(1);
}

const text = fs.readFileSync(flags.script, 'utf8').replace(/\s+/g, ' ').trim();
const paths = projectPaths(flags.project);
fs.mkdirSync(paths.publicDir, {recursive: true});
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-'));

const sample = flags.sample ?? process.env.VOICE_SAMPLE;
const python = process.env.VOICE_PYTHON ?? path.join(ROOT, '.voice-venv', 'bin', 'python');
const engine =
	flags.engine ??
	(sample ? 'clone' : process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : fs.existsSync(python) ? 'chatterbox' : 'espeak');
let rawAudio;

if (engine === 'clone' || engine === 'chatterbox') {
	if (!fs.existsSync(python)) throw new Error('Chatterbox is not installed. Run: bash scripts/setup-voice-clone.sh');
	const args = [path.join(ROOT, 'scripts', 'clone_voice.py'), '--model', flags.model ?? 'turbo'];
	if (engine === 'clone') {
		if (!sample || !fs.existsSync(sample)) throw new Error('Voice cloning needs --sample <recording of your voice> (10-30 seconds).');
		// Clean reference: mono 24 kHz, leading silence removed, loudness normalized, at most 30 s.
		const ref = path.join(tmp, 'reference.wav');
		ffmpeg(['-i', sample, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-18:TP=-2,atrim=0:30', '-ar', '24000', '-ac', '1', ref]);
		args.push('--sample', ref);
		console.log(`Cloning your voice from ${sample} with Chatterbox (local, no API key)...`);
	} else {
		console.log("Chatterbox built-in narrator voice (local, no API key). Pass --sample to use your own voice...");
	}
	const textFile = path.join(tmp, 'script.txt');
	fs.writeFileSync(textFile, text);
	rawAudio = path.join(tmp, 'chatterbox.wav');
	args.push('--text', textFile, '--out', rawAudio);
	execFileSync(python, args, {stdio: 'inherit'});
} else if (engine === 'elevenlabs') {
	const key = process.env.ELEVENLABS_API_KEY;
	if (!key) throw new Error('ELEVENLABS_API_KEY is not set. Add it as a secret or use --engine espeak.');
	// "Adam" is a stock ElevenLabs voice. Pass --voice to use your own.
	const voice = flags.voice ?? process.env.ELEVENLABS_VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB';
	const model = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';
	console.log(`ElevenLabs voice ${voice}, model ${model}...`);
	const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
		method: 'POST',
		headers: {'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg'},
		body: JSON.stringify({text, model_id: model, voice_settings: {stability: 0.45, similarity_boost: 0.8, style: 0.3}}),
	});
	if (!res.ok) throw new Error(`ElevenLabs request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
	rawAudio = path.join(tmp, 'eleven.mp3');
	fs.writeFileSync(rawAudio, Buffer.from(await res.arrayBuffer()));
} else {
	const voice = flags.voice ?? 'en-us+m3';
	console.log(`Local eSpeak NG voice ${voice} (set ELEVENLABS_API_KEY for a natural voice)...`);
	rawAudio = path.join(tmp, 'espeak.wav');
	execFileSync('espeak-ng', ['-v', voice, '-s', String(flags.speed ?? 165), '-p', '40', '-w', rawAudio, text]);
}

const transcribeScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'transcribe.mjs');
execFileSync(process.execPath, [transcribeScript, '--project', flags.project, '--script', flags.script, rawAudio], {stdio: 'inherit'});
fs.rmSync(tmp, {recursive: true, force: true});
