import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {downloadWhisperModel, installWhisperCpp} from '@remotion/install-whisper-cpp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const WHISPER_DIR = path.join(root, '.whisper');
export const WHISPER_VERSION = '1.7.4';
export const WHISPER_MODEL = process.env.WHISPER_MODEL ?? 'base.en';

export async function ensureWhisper() {
	await installWhisperCpp({to: WHISPER_DIR, version: WHISPER_VERSION, printOutput: false});
	await downloadWhisperModel({model: WHISPER_MODEL, folder: WHISPER_DIR, printOutput: false});
	return {whisperPath: WHISPER_DIR, whisperCppVersion: WHISPER_VERSION, model: WHISPER_MODEL};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	console.log('Installing whisper.cpp and the', WHISPER_MODEL, 'model (one time)...');
	await ensureWhisper();
	console.log('whisper.cpp ready in', WHISPER_DIR);
}
