#!/usr/bin/env node
// Synthesizes the built-in sound effects into public/sfx/ with FFmpeg. Original, royalty-free.
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg, ROOT} from './lib.mjs';

const out = path.join(ROOT, 'public', 'sfx');
fs.mkdirSync(out, {recursive: true});

const SFX = {
	whoosh: ['-f', 'lavfi', '-i', 'anoisesrc=d=0.55:c=pink:a=0.9', '-af', 'highpass=f=400,lowpass=f=4000,afade=t=in:d=0.25,afade=t=out:st=0.25:d=0.3'],
	pop: ['-f', 'lavfi', '-i', "aevalsrc='0.8*sin(2*PI*(500+900*exp(-t*35))*t)*exp(-t*28)':d=0.18"],
	ding: ['-f', 'lavfi', '-i', "aevalsrc='0.5*(sin(2*PI*1318*t)+0.45*sin(2*PI*2637*t))*exp(-t*4)':d=1.1"],
	cash: ['-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*2093*t)*exp(-t*6)+0.35*sin(2*PI*3136*(t-0.08))*exp(-(t-0.08)*7)*gte(t,0.08)+0.4*(random(0)-0.5)*exp(-t*50)':d=0.9"],
	boom: ['-f', 'lavfi', '-i', "aevalsrc='0.9*sin(2*PI*(45+90*exp(-t*9))*t)*exp(-t*3)':d=1.1"],
	tick: ['-f', 'lavfi', '-i', "aevalsrc='0.6*sin(2*PI*2600*t)*exp(-t*140)':d=0.06"],
};

for (const [name, args] of Object.entries(SFX)) {
	ffmpeg([...args, '-ar', '44100', '-ac', '1', path.join(out, `${name}.wav`)]);
	console.log('wrote', `public/sfx/${name}.wav`);
}
