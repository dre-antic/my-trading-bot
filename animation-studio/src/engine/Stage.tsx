import React from 'react';
import * as THREE from 'three';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CameraMove} from './types';
import type {Theme} from './theme';

export type CameraState = {position: [number, number, number]; target: [number, number, number]; fov: number};

/** Horizontal layout multiplier, so the same x positions work for 16:9 and 9:16. */
export const useLayoutScale = () => {
	const {width, height} = useVideoConfig();
	return width / height < 1 ? 0.42 : 1;
};

export const cameraAt = (
	move: CameraMove | undefined,
	frame: number,
	duration: number,
	aspect: number,
	focus: [number, number, number] = [0, 1.25, 0],
	fps = 30,
): CameraState => {
	const dist = aspect < 1 ? 10.5 : 7;
	// Short scenes get a gentler move so the camera never lunges.
	const travel = Math.min(0.9, (duration / fps) * 0.18);
	const t = interpolate(frame, [0, Math.max(1, duration)], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.inOut(Easing.cubic),
	});
	let x = focus[0];
	let z = dist;
	let y = 1.75;
	switch (move ?? 'push') {
		case 'push':
			z = dist - travel * t;
			break;
		case 'pull':
			z = dist - travel + travel * t;
			break;
		case 'panLeft':
			x = focus[0] + travel * 0.7 - travel * 1.4 * t;
			break;
		case 'panRight':
			x = focus[0] - travel * 0.7 + travel * 1.4 * t;
			break;
		case 'orbit': {
			const a = -0.35 + 0.7 * t;
			x = focus[0] + Math.sin(a) * dist;
			z = Math.cos(a) * dist;
			break;
		}
		case 'still':
		default:
			break;
	}
	return {position: [x, y, z], target: focus, fov: 34};
};

const CameraRig: React.FC<{cam: CameraState}> = ({cam}) => {
	const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
	camera.position.set(...cam.position);
	camera.fov = cam.fov;
	camera.lookAt(new THREE.Vector3(...cam.target));
	camera.updateProjectionMatrix();
	return null;
};

/** Projects a world point to pixel coordinates for 2D overlays (labels, numbers). */
export const projectToScreen = (
	point: [number, number, number],
	cam: CameraState,
	width: number,
	height: number,
): {x: number; y: number} => {
	const c = new THREE.PerspectiveCamera(cam.fov, width / height, 0.1, 200);
	c.position.set(...cam.position);
	c.lookAt(new THREE.Vector3(...cam.target));
	c.updateMatrixWorld();
	c.updateProjectionMatrix();
	const v = new THREE.Vector3(...point).project(c);
	return {x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height};
};

export const Stage: React.FC<{
	theme: Theme;
	cam: CameraState;
	children: React.ReactNode;
	overlay?: React.ReactNode;
}> = ({theme, cam, children, overlay}) => {
	const {width, height} = useVideoConfig();
	return (
		<AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 40%, ${lighten(theme.background)} 0%, ${theme.background} 70%)`}}>
			<ThreeCanvas width={width} height={height} shadows gl={{antialias: true, preserveDrawingBuffer: true}}>
				<CameraRig cam={cam} />
				<ambientLight intensity={1.25} />
				<hemisphereLight args={['#ffffff', '#c8bfae', 0.6]} />
				<directionalLight
					position={[3.5, 7, 5]}
					intensity={1.9}
					castShadow
					shadow-mapSize-width={2048}
					shadow-mapSize-height={2048}
					shadow-camera-left={-8}
					shadow-camera-right={8}
					shadow-camera-top={8}
					shadow-camera-bottom={-8}
					shadow-bias={-0.0004}
				/>
				<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
					<planeGeometry args={[80, 80]} />
					<shadowMaterial opacity={theme.floorShadow} />
				</mesh>
				{children}
			</ThreeCanvas>
			{overlay}
		</AbsoluteFill>
	);
};

const lighten = (hex: string) => {
	const c = new THREE.Color(hex);
	c.lerp(new THREE.Color('#ffffff'), 0.35);
	return `#${c.getHexString()}`;
};

/** Camera state for the current frame of the current scene. */
export const useSceneCamera = (move: CameraMove | undefined, focus: [number, number, number] = [0, 1.25, 0], headline = false) => {
	const frame = useCurrentFrame();
	const {durationInFrames, width, height, fps} = useVideoConfig();
	// Aim a little higher when a headline is shown so the characters sit below it.
	const f: [number, number, number] = headline ? [focus[0], focus[1] + 0.4, focus[2]] : focus;
	return cameraAt(move, frame, durationInFrames, width / height, f, fps);
};
