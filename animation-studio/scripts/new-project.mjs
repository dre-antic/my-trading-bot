#!/usr/bin/env node
// Scaffold a new video project and register it in src/projects/index.ts.
//
//   node scripts/new-project.mjs my-video "My Video Title" [--vertical]
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs, projectPaths, ROOT} from './lib.mjs';

const {flags, positional} = parseArgs(process.argv.slice(2));
const [id, title = id] = positional;
if (!id) {
	console.error('Usage: node scripts/new-project.mjs <kebab-id> "Title" [--vertical]');
	process.exit(1);
}
const paths = projectPaths(id);
if (fs.existsSync(paths.storyboard)) throw new Error(`${path.relative(ROOT, paths.storyboard)} already exists`);
fs.mkdirSync(paths.srcDir, {recursive: true});
fs.mkdirSync(paths.publicDir, {recursive: true});
if (!fs.existsSync(paths.captions)) fs.writeFileSync(paths.captions, '[]\n');

const camel = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const size = flags.vertical ? 'width: 1080,\n\theight: 1920,' : 'width: 1920,\n\theight: 1080,';
fs.writeFileSync(
	paths.storyboard,
	`import type {Caption} from '@remotion/captions';
import type {Storyboard} from '../../engine/types';
import captions from './captions.json';

export const ${camel}: Storyboard = {
	id: '${camel.charAt(0).toUpperCase() + camel.slice(1)}',
	title: ${JSON.stringify(title)},
	${size}
	fps: 30,
	audio: 'projects/${id}/voiceover.mp3',
	captions: captions as Caption[],
	theme: 'cream',
	characterStyle: 'mannequin',
	characterColor: '#4c6ef5',
	scenes: [
		{type: 'title', from: 0, to: 3, title: ${JSON.stringify(title)}},
	],
};
`,
);

const indexFile = path.join(ROOT, 'src', 'projects', 'index.ts');
let index = fs.readFileSync(indexFile, 'utf8');
index = index.replace('// @new-project-import', `import {${camel}} from './${id}/storyboard';\n// @new-project-import`);
index = index.replace(/export const projects: Storyboard\[\] = \[([\s\S]*?)\];/, (_, list) => {
	const items = list.split(',').map((s) => s.trim()).filter(Boolean);
	items.push(camel);
	return `export const projects: Storyboard[] = [${items.join(', ')}];`;
});
fs.writeFileSync(indexFile, index);
console.log(`Created ${path.relative(ROOT, paths.storyboard)} and registered composition "${camel.charAt(0).toUpperCase() + camel.slice(1)}".`);
