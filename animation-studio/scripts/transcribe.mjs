#!/usr/bin/env node
// Turn one or more voiceover files (e.g. ElevenLabs downloads, part 1..3) into the project's
// voiceover.mp3 plus word-level captions.json and a sentence timeline.txt.
//
//   node scripts/transcribe.mjs --project my-video [--script script.txt] part1.mp3 part2.mp3 part3.mp3
//
// With --script, captions use the exact written words (whisper only supplies the timings).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {toCaptions, transcribe} from '@remotion/install-whisper-cpp';
import {ensureWhisper} from './whisper.mjs';
import {alignToScript, audioDuration, ffmpeg, parseArgs, projectPaths, writeTimeline} from './lib.mjs';

const {flags, positional} = parseArgs(process.argv.slice(2));
if (!flags.project || positional.length === 0) {
	console.error('Usage: node scripts/transcribe.mjs --project <id> [--script script.txt] <audio> [more audio parts...]');
	process.exit(1);
}

const paths = projectPaths(flags.project);
fs.mkdirSync(paths.publicDir, {recursive: true});
fs.mkdirSync(paths.srcDir, {recursive: true});

const inputs = positional.map((p) => path.resolve(p));
for (const f of inputs) if (!fs.existsSync(f)) throw new Error(`Audio not found: ${f}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vo-'));
const merged = path.join(tmp, 'merged.wav');
if (inputs.length === 1) {
	ffmpeg(['-i', inputs[0], '-ar', '44100', '-ac', '1', merged]);
} else {
	// Small gap between parts so sentences don't run together.
	const filter = inputs.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono,apad=pad_dur=0.35[a${i}];`).join('') +
		inputs.map((_, i) => `[a${i}]`).join('') + `concat=n=${inputs.length}:v=0:a=1[out]`;
	ffmpeg([...inputs.flatMap((f) => ['-i', f]), '-filter_complex', filter, '-map', '[out]', merged]);
}
const samePath = inputs.length === 1 && path.resolve(inputs[0]) === paths.audio;
if (!samePath) ffmpeg(['-i', merged, '-codec:a', 'libmp3lame', '-b:a', '192k', paths.audio]);

const wav16 = path.join(tmp, '16k.wav');
ffmpeg(['-i', merged, '-ar', '16000', '-ac', '1', wav16]);

console.log('Transcribing with whisper.cpp for word timings...');
const w = await ensureWhisper();
const out = await transcribe({
	inputPath: wav16,
	whisperPath: w.whisperPath,
	whisperCppVersion: w.whisperCppVersion,
	model: w.model,
	tokenLevelTimestamps: true,
	splitOnWord: true,
	printOutput: false,
});
const {captions} = toCaptions({whisperCppOutput: out});
const heard = captions.filter((c) => c.text.trim() && !/^\[.*\]$/.test(c.text.trim()));
const cleaned = flags.script ? alignToScript(heard, fs.readFileSync(flags.script, 'utf8')) : heard;
if (flags.script) console.log('Captions aligned to the written script.');
fs.writeFileSync(paths.captions, JSON.stringify(cleaned, null, '\t') + '\n');
const lines = writeTimeline(cleaned, paths.timeline);
fs.rmSync(tmp, {recursive: true, force: true});

console.log(`\nVoiceover: public/${paths.audioStaticPath} (${audioDuration(paths.audio).toFixed(2)}s)`);
console.log(`Captions:  ${path.relative(process.cwd(), paths.captions)} (${cleaned.length} words)`);
console.log(`Timeline:  ${path.relative(process.cwd(), paths.timeline)}\n`);
console.log(lines.join('\n'));
