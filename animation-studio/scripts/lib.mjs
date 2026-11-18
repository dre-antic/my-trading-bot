import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const projectPaths = (id) => {
	if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`Project id must be kebab-case, got "${id}"`);
	const publicDir = path.join(ROOT, 'public', 'projects', id);
	const srcDir = path.join(ROOT, 'src', 'projects', id);
	return {
		publicDir,
		srcDir,
		audio: path.join(publicDir, 'voiceover.mp3'),
		audioStaticPath: `projects/${id}/voiceover.mp3`,
		captions: path.join(srcDir, 'captions.json'),
		timeline: path.join(srcDir, 'timeline.txt'),
		storyboard: path.join(srcDir, 'storyboard.ts'),
	};
};

export const ffmpeg = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {stdio: 'inherit'});

export const audioDuration = (file) =>
	Number(
		execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
			.toString()
			.trim(),
	);

export const parseArgs = (argv) => {
	const flags = {};
	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith('--')) {
			const key = a.slice(2);
			const next = argv[i + 1];
			if (next === undefined || next.startsWith('--')) flags[key] = true;
			else {
				flags[key] = next;
				i++;
			}
		} else positional.push(a);
	}
	return {flags, positional};
};

const norm = (w) => w.toLowerCase().replace(/[^a-z0-9$%]/g, '');

/**
 * Replace transcribed words with the exact words of the written script, keeping whisper's timings.
 * Words are matched with a global alignment, so misheard or missing words still get sensible times.
 */
export const alignToScript = (captions, scriptText) => {
	const script = scriptText.split(/\s+/).filter(Boolean);
	const heard = captions.map((c) => norm(c.text));
	const said = script.map(norm);
	const n = said.length;
	const m = heard.length;
	const score = Array.from({length: n + 1}, () => new Float64Array(m + 1));
	const move = Array.from({length: n + 1}, () => new Uint8Array(m + 1));
	for (let i = 1; i <= n; i++) {
		score[i][0] = -i;
		move[i][0] = 1;
	}
	for (let j = 1; j <= m; j++) {
		score[0][j] = -j;
		move[0][j] = 2;
	}
	for (let i = 1; i <= n; i++) {
		for (let j = 1; j <= m; j++) {
			const same = said[i - 1] && said[i - 1] === heard[j - 1];
			const diag = score[i - 1][j - 1] + (same ? 2 : -0.5);
			const up = score[i - 1][j] - 1;
			const left = score[i][j - 1] - 1;
			if (diag >= up && diag >= left) {
				score[i][j] = diag;
				move[i][j] = 0;
			} else if (up >= left) {
				score[i][j] = up;
				move[i][j] = 1;
			} else {
				score[i][j] = left;
				move[i][j] = 2;
			}
		}
	}
	const pairs = new Array(n).fill(null);
	for (let i = n, j = m; i > 0 || j > 0; ) {
		const mv = move[i][j];
		if (i > 0 && j > 0 && mv === 0) {
			pairs[i - 1] = j - 1;
			i--;
			j--;
		} else if (i > 0 && (j === 0 || mv === 1)) i--;
		else j--;
	}
	const out = script.map((word, i) => {
		const k = pairs[i];
		return {
			text: (i === 0 ? '' : ' ') + word,
			startMs: k === null ? NaN : captions[k].startMs,
			endMs: k === null ? NaN : captions[k].endMs,
			timestampMs: k === null ? null : captions[k].timestampMs,
			confidence: k === null ? null : captions[k].confidence,
		};
	});
	// Spread unmatched words evenly between their matched neighbours.
	for (let i = 0; i < out.length; ) {
		if (!Number.isNaN(out[i].startMs)) {
			i++;
			continue;
		}
		let j = i;
		while (j < out.length && Number.isNaN(out[j].startMs)) j++;
		const from = i > 0 ? out[i - 1].endMs : (captions[0]?.startMs ?? 0);
		const to = j < out.length ? out[j].startMs : (captions.at(-1)?.endMs ?? from + 400 * (j - i));
		const step = Math.max(0, to - from) / (j - i);
		for (let k = i; k < j; k++) {
			out[k].startMs = Math.round(from + step * (k - i));
			out[k].endMs = Math.round(from + step * (k - i + 1));
		}
		i = j;
	}
	for (let i = 1; i < out.length; i++) if (out[i].startMs < out[i - 1].endMs) out[i].startMs = out[i - 1].endMs;
	for (const c of out) if (c.endMs < c.startMs) c.endMs = c.startMs;
	return out;
};

/** Human-readable timeline: one line per sentence with start/end seconds, used to time scenes. */
export const writeTimeline = (captions, file) => {
	const lines = [];
	let cur = [];
	const flush = () => {
		if (!cur.length) return;
		const text = cur.map((c) => c.text).join('').trim();
		lines.push(`[${(cur[0].startMs / 1000).toFixed(2)} - ${(cur.at(-1).endMs / 1000).toFixed(2)}] ${text}`);
		cur = [];
	};
	for (const c of captions) {
		cur.push(c);
		if (/[.!?]["']?$/.test(c.text.trim())) flush();
	}
	flush();
	fs.writeFileSync(file, lines.join('\n') + '\n');
	return lines;
};
