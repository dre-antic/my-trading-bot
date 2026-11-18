import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CharacterStyle, Mood, Pose} from './types';

type Arm = {raise: number; forward: number; elbow: number; elbowForward: number};
type PoseDef = {left: Arm; right: Arm; headTilt: number; headNod: number; lean: number};

const arm = (raise: number, forward = 0, elbow = 0, elbowForward = 0): Arm => ({
	raise,
	forward,
	elbow,
	elbowForward,
});

const POSES: Record<Pose, PoseDef> = {
	idle: {left: arm(0.12, 0, 0.1), right: arm(0.12, 0, 0.1), headTilt: 0, headNod: 0, lean: 0},
	wave: {left: arm(0.12, 0, 0.1), right: arm(2.5, 0, 0.5), headTilt: -0.12, headNod: 0, lean: 0},
	// Screen directions for a character facing the camera: its right arm points to screen-left.
	pointLeft: {left: arm(0.12, 0, 0.1), right: arm(1.45, 0.15, 0.05), headTilt: 0, headNod: 0, lean: -0.04},
	pointRight: {left: arm(1.45, 0.15, 0.05), right: arm(0.12, 0, 0.1), headTilt: 0, headNod: 0, lean: 0.04},
	point: {left: arm(1.45, 0.15, 0.05), right: arm(0.12, 0, 0.1), headTilt: 0, headNod: 0, lean: 0.04},
	shrug: {left: arm(0.55, 0.2, 1.3), right: arm(0.55, 0.2, 1.3), headTilt: 0.18, headNod: 0, lean: 0},
	cheer: {left: arm(2.7, 0, 0.25), right: arm(2.7, 0, 0.25), headTilt: 0, headNod: -0.15, lean: 0},
	think: {left: arm(0.2, 0.5, 0.2, 1.9), right: arm(0.1, 0.95, 0, 2.2), headTilt: 0.15, headNod: -0.12, lean: 0},
	sad: {left: arm(0.04, 0, 0), right: arm(0.04, 0, 0), headTilt: 0, headNod: 0.4, lean: 0.12},
	walk: {left: arm(0.1, 0, 0.2), right: arm(0.1, 0, 0.2), headTilt: 0, headNod: 0, lean: 0.03},
	present: {left: arm(0.85, 0.5, 0.35), right: arm(0.85, 0.5, 0.35), headTilt: 0, headNod: -0.05, lean: 0},
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpArm = (a: Arm, b: Arm, t: number): Arm => ({
	raise: lerp(a.raise, b.raise, t),
	forward: lerp(a.forward, b.forward, t),
	elbow: lerp(a.elbow, b.elbow, t),
	elbowForward: lerp(a.elbowForward, b.elbowForward, t),
});

type Palette = {skin: string; limb: string; torso: string; accent?: string; limbRadius: number; torsoRadius: number};

const palette = (style: CharacterStyle, color: string): Palette => {
	switch (style) {
		case 'stick':
			return {skin: '#ffffff', limb: '#1c1b22', torso: '#1c1b22', limbRadius: 0.035, torsoRadius: 0.04};
		case 'suit':
			return {skin: '#f7f4ee', limb: color, torso: color, accent: '#d62839', limbRadius: 0.075, torsoRadius: 0.2};
		case 'mannequin':
		default:
			return {skin: '#f7f4ee', limb: '#f7f4ee', torso: color, limbRadius: 0.075, torsoRadius: 0.19};
	}
};

const Mat: React.FC<{color: string}> = ({color}) => (
	<meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
);

const Limb: React.FC<{length: number; radius: number; color: string}> = ({length, radius, color}) => (
	<mesh position={[0, -length / 2, 0]} castShadow>
		<capsuleGeometry args={[radius, Math.max(0.01, length - radius * 2), 6, 12]} />
		<Mat color={color} />
	</mesh>
);

const ArmRig: React.FC<{side: 1 | -1; a: Arm; p: Palette}> = ({side, a, p}) => (
	<group position={[side * (p.torsoRadius + p.limbRadius * 0.55), 1.5, 0]} rotation={[-a.forward, 0, side * a.raise]}>
		<Limb length={0.42} radius={p.limbRadius} color={p.limb} />
		<group position={[0, -0.42, 0]} rotation={[-a.elbowForward, 0, side * a.elbow]}>
			<Limb length={0.38} radius={p.limbRadius * 0.92} color={p.limb} />
			<mesh position={[0, -0.4, 0]} castShadow>
				<sphereGeometry args={[p.limbRadius * 1.25 + 0.01, 16, 16]} />
				<Mat color={p.skin} />
			</mesh>
		</group>
	</group>
);

const Face: React.FC<{mood: Mood; mouth: number; blink: number}> = ({mood, mouth, blink}) => {
	const eyeY = 0.06;
	const browAngle = mood === 'angry' ? 0.45 : mood === 'sad' ? -0.35 : mood === 'shocked' ? -0.1 : 0;
	const browY = mood === 'shocked' ? 0.2 : 0.16;
	const eyeScaleY = mood === 'shocked' ? 1.35 : blink;
	return (
		<group position={[0, 0, 0.27]}>
			{[-1, 1].map((s) => (
				<group key={s}>
					<mesh position={[s * 0.1, eyeY, 0.02]} scale={[1, eyeScaleY, 1]}>
						<sphereGeometry args={[0.038, 16, 16]} />
						<meshBasicMaterial color="#141414" />
					</mesh>
					<mesh position={[s * 0.1, browY, 0.0]} rotation={[0, 0, s * browAngle]}>
						<boxGeometry args={[0.09, 0.018, 0.02]} />
						<meshBasicMaterial color="#141414" />
					</mesh>
				</group>
			))}
			{mouth > 0.02 ? (
				<mesh position={[0, -0.1, 0.0]} scale={[1, 0.25 + mouth * 0.9, 0.4]}>
					<sphereGeometry args={[0.055, 16, 16]} />
					<meshBasicMaterial color="#3a1416" />
				</mesh>
			) : mood === 'shocked' ? (
				<mesh position={[0, -0.11, 0]}>
					<torusGeometry args={[0.035, 0.012, 8, 24]} />
					<meshBasicMaterial color="#141414" />
				</mesh>
			) : mood === 'happy' || mood === 'sad' ? (
				<mesh position={[0, mood === 'happy' ? -0.07 : -0.14, 0]} rotation={[0, 0, mood === 'happy' ? Math.PI : 0]}>
					<torusGeometry args={[0.065, 0.012, 8, 24, Math.PI]} />
					<meshBasicMaterial color="#141414" />
				</mesh>
			) : (
				<mesh position={[0, -0.1, 0]}>
					<boxGeometry args={[0.08, 0.016, 0.01]} />
					<meshBasicMaterial color="#141414" />
				</mesh>
			)}
		</group>
	);
};

export type CharacterProps = {
	pose?: Pose;
	mood?: Mood;
	style?: CharacterStyle;
	color?: string;
	mouth?: number;
	position?: [number, number, number];
	turn?: number;
	scale?: number;
	/** Frame offset so several characters don't move in lockstep. */
	seed?: number;
	children?: React.ReactNode;
};

/** A procedural 3D character. Feet sit at y=0, the head top is at about y=2.3. */
export const Character: React.FC<CharacterProps> = ({
	pose = 'idle',
	mood = 'neutral',
	style = 'mannequin',
	color = '#4c6ef5',
	mouth = 0,
	position = [0, 0, 0],
	turn = 0,
	scale = 1,
	seed = 0,
	children,
}) => {
	const frame = useCurrentFrame() + seed * 7;
	const {fps} = useVideoConfig();
	const local = useCurrentFrame();
	const enter = spring({frame: local, fps, config: {damping: 14, stiffness: 120}, durationInFrames: 18});
	const target = POSES[pose];
	const base = POSES.idle;
	const p = palette(style, color);
	const t = frame / fps;

	let left = lerpArm(base.left, target.left, enter);
	let right = lerpArm(base.right, target.right, enter);
	let bodyY = 0;
	let legSwing = 0;
	if (pose === 'wave') right = {...right, elbow: right.elbow + Math.sin(t * 9) * 0.45 * enter};
	if (pose === 'cheer') bodyY = Math.abs(Math.sin(t * 6)) * 0.18 * enter;
	if (pose === 'walk') {
		legSwing = Math.sin(t * 8) * 0.45;
		left = {...left, forward: -legSwing * 0.8};
		right = {...right, forward: legSwing * 0.8};
		bodyY = Math.abs(Math.sin(t * 8)) * 0.04;
	}
	if (pose === 'pointLeft') right = {...right, raise: right.raise + Math.sin(t * 4) * 0.04};
	if (pose === 'point' || pose === 'pointRight') left = {...left, raise: left.raise + Math.sin(t * 4) * 0.04};

	const breathe = Math.sin(t * 2.2) * 0.012;
	const sway = Math.sin(t * 1.3) * 0.03;
	const blinkPhase = (frame % 110) / 110;
	const blink = blinkPhase > 0.96 ? 0.15 : 1;
	const headTilt = lerp(base.headTilt, target.headTilt, enter) + sway * 0.5;
	const headNod = lerp(base.headNod, target.headNod, enter) + mouth * 0.04;
	const lean = lerp(base.lean, target.lean, enter);

	return (
		<group position={position} rotation={[0, turn, 0]} scale={scale}>
			<group position={[0, bodyY, 0]} rotation={[lean, 0, sway * 0.3]}>
				{[-1, 1].map((s) => (
					<group key={s} position={[s * 0.11, 0.92, 0]} rotation={[s * legSwing, 0, s * 0.03]}>
						<Limb length={0.9} radius={p.limbRadius * 1.05} color={p.limb} />
						<mesh position={[0, -0.9, 0.05]} castShadow>
							<sphereGeometry args={[p.limbRadius * 1.3 + 0.02, 16, 12]} />
							<Mat color={p.limb} />
						</mesh>
					</group>
				))}
				<group scale={[1, 1 + breathe, 1]}>
					<mesh position={[0, 1.27, 0]} castShadow>
						<capsuleGeometry args={[p.torsoRadius, 0.5 - p.torsoRadius, 8, 16]} />
						<Mat color={p.torso} />
					</mesh>
					{p.accent ? (
						<mesh position={[0, 1.36, p.torsoRadius + 0.005]} castShadow>
							<boxGeometry args={[0.06, 0.32, 0.02]} />
							<Mat color={p.accent} />
						</mesh>
					) : null}
					<ArmRig side={1} a={left} p={p} />
					<ArmRig side={-1} a={right} p={p} />
				</group>
				<group position={[0, 1.58, 0]} rotation={[headNod, 0, headTilt]}>
					<mesh position={[0, 0.06, 0]} castShadow>
						<cylinderGeometry args={[0.06, 0.07, 0.2, 12]} />
						<Mat color={p.skin} />
					</mesh>
					<group position={[0, 0.42, 0]}>
						<mesh castShadow>
							<sphereGeometry args={[0.3, 32, 32]} />
							<Mat color={p.skin} />
						</mesh>
						<Face mood={mood} mouth={mouth} blink={blink} />
					</group>
				</group>
				{children}
			</group>
		</group>
	);
};
