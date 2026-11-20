import {Config} from '@remotion/cli/config';

// Three.js needs WebGL in headless Chrome. Machines without a GPU (Linux servers, CI) need the software renderer.
Config.setChromiumOpenGlRenderer(process.platform === 'darwin' ? 'angle' : 'swangle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(process.env.REMOTION_CONCURRENCY ? Number(process.env.REMOTION_CONCURRENCY) : null);
