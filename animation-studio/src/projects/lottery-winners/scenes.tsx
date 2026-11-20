import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Character} from '../../engine/Character';
import {Bill, House} from '../../engine/Props';
import {projectToScreen, Stage, useSceneCamera} from '../../engine/Stage';
import {fontFamily, Headline, Tag} from '../../engine/Text';
import type {CustomScene, SceneProps} from '../../engine/types';

const Car: React.FC<{position: [number, number, number]; scale?: number; color?: string}> = ({position, scale = 1, color = '#e5484d'}) => (
	<group position={position} scale={scale}>
		<mesh position={[0, 0.28, 0]} castShadow>
			<boxGeometry args={[1.1, 0.3, 0.55]} />
			<meshStandardMaterial color={color} roughness={0.35} metalness={0.2} />
		</mesh>
		<mesh position={[-0.05, 0.53, 0]} castShadow>
			<boxGeometry args={[0.6, 0.24, 0.5]} />
			<meshStandardMaterial color="#cfe8ff" roughness={0.2} />
		</mesh>
		{[-0.35, 0.35].flatMap((x) =>
			[-0.28, 0.28].map((z) => (
				<mesh key={`${x}${z}`} position={[x, 0.13, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
					<cylinderGeometry args={[0.13, 0.13, 0.08, 20]} />
					<meshStandardMaterial color="#1c1b22" />
				</mesh>
			)),
		)}
	</group>
);

const Handshake: React.FC<{position: [number, number, number]; scale?: number}> = ({position, scale = 1}) => (
	<group position={position} scale={scale}>
		<Bill position={[0, 0.5, 0]} rotation={[Math.PI / 2.4, 0, 0.2]} scale={1.2} />
		<Bill position={[0.08, 0.42, 0.05]} rotation={[Math.PI / 2.2, 0, -0.15]} scale={1.2} />
	</group>
);

type Item = {kind: 'car' | 'house' | 'loan'; label: string; at: number};

/** A pile of cash stacks that shrinks over the scene while purchases pop in. */
export const ShrinkingPile: React.FC<SceneProps<CustomScene>> = ({scene, theme, defaultColor, mouth}) => {
	const frame = useCurrentFrame();
	const {fps, durationInFrames, width, height} = useVideoConfig();
	const cam = useSceneCamera(scene.camera ?? 'still', [0.1, 0.75, 0]);
	const props = (scene.props ?? {}) as {startFill?: number; endFill?: number; items?: Item[]};
	const startFill = props.startFill ?? 1;
	const endFill = props.endFill ?? 0.25;
	const items = props.items ?? [];
	const fill = interpolate(frame, [0, durationInFrames], [startFill, endFill], {easing: Easing.inOut(Easing.quad)});
	const cols = 5;
	const rows = 3;
	const perStack = 9;
	const total = cols * rows * perStack;
	const visible = Math.round(total * fill);
	const stacks: React.ReactNode[] = [];
	let n = 0;
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const x = -3.0 + c * 0.62;
			const z = -0.9 + r * 0.36;
			const h = Math.max(0, Math.min(perStack, visible - n));
			n += perStack;
			for (let k = 0; k < h; k++) stacks.push(<Bill key={`${r}-${c}-${k}`} position={[x, 0.01 + k * 0.03, z]} rotation={[0, (k % 3) * 0.04, 0]} />);
		}
	}
	const itemX = [0.4, 1.75, 3.1];
	const pileLabel = projectToScreen([-1.76, 0.75, -0.55], cam, width, height);
	return (
		<Stage
			theme={theme}
			cam={cam}
			overlay={
				<>
					{scene.headline ? <Headline text={scene.headline} theme={theme} /> : null}
					{items.map((it, i) => {
						const local = frame - Math.round(it.at * fps);
						if (local < 0) return null;
						const p = projectToScreen([itemX[i % 3], it.kind === 'house' ? 1.35 : 0.95, 0.3], cam, width, height);
						return <Tag key={i} text={it.label} x={p.x} y={p.y} theme={theme} color={theme.negative} />;
					})}
					<Tag text={`${Math.round(fill * 100)}% left`} x={pileLabel.x} y={pileLabel.y} theme={theme} color={theme.positive} size={1.3} />
				</>
			}
		>
			{stacks}
			{items.map((it, i) => {
				const local = frame - Math.round(it.at * fps);
				if (local < 0) return null;
				const s = spring({frame: local, fps, config: {damping: 11, stiffness: 150}});
				const pos: [number, number, number] = [itemX[i % 3], 0, 0.3];
				if (it.kind === 'car') return <Car key={i} position={pos} scale={s * 0.85} />;
				if (it.kind === 'house') return <House key={i} position={pos} scale={s * 1.1} />;
				return <Handshake key={i} position={pos} scale={s} />;
			})}
			{items.length === 0 ? (
				<Character pose="think" mood="sad" color={defaultColor} mouth={mouth} position={[1.5, 0, 0.2]} turn={-0.4} scale={0.8} />
			) : null}
		</Stage>
	);
};

const seeded = (i: number) => {
	const x = Math.sin(i * 91.17 + 12.3) * 43758.5453;
	return x - Math.floor(x);
};

/** A slowly turning cloud of lottery balls with a single gold winner pulled out to the front. */
export const LotteryBalls: React.FC<SceneProps<CustomScene>> = ({scene, theme}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const cam = useSceneCamera(scene.camera ?? 'push', [0, 1.25, 0]);
	const label = String((scene.props as {label?: string} | undefined)?.label ?? '');
	const t = frame / fps;
	const spin = t * 0.25;
	const out = spring({frame: frame - 20, fps, config: {damping: 14, stiffness: 70}});
	const balls = Array.from({length: 420}).map((_, i) => {
		const u = seeded(i);
		const v = seeded(i + 999);
		const r = 1.6 * Math.cbrt(seeded(i + 555));
		const th = u * Math.PI * 2 + spin;
		const ph = Math.acos(2 * v - 1);
		return [r * Math.sin(ph) * Math.cos(th) * 1.5, 1.5 + r * Math.cos(ph) * 0.8, r * Math.sin(ph) * Math.sin(th) - 1] as [number, number, number];
	});
	const goldPos: [number, number, number] = [
		interpolate(out, [0, 1], [balls[0][0], 0]),
		interpolate(out, [0, 1], [balls[0][1], 1.5]),
		interpolate(out, [0, 1], [balls[0][2], 2.2]),
	];
	const labelIn = interpolate(frame, [30, 42], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<Stage
			theme={theme}
			cam={cam}
			overlay={
				<>
					{scene.headline ? <Headline text={scene.headline} theme={theme} /> : null}
					{label ? <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: height * 0.17}}>
						<div
							style={{
								fontFamily,
								fontWeight: 900,
								fontSize: width * 0.06,
								color: theme.ink,
								background: theme.accent,
								padding: '0.1em 0.5em',
								borderRadius: 24,
								opacity: labelIn,
								transform: `scale(${0.8 + labelIn * 0.2})`,
							}}
						>
							{label}
						</div>
					</AbsoluteFill> : null}
				</>
			}
		>
			{balls.slice(1).map((p, i) => (
				<mesh key={i} position={p} castShadow>
					<sphereGeometry args={[0.07, 12, 12]} />
					<meshStandardMaterial color={i % 9 === 0 ? '#e5484d' : '#ffffff'} roughness={0.35} />
				</mesh>
			))}
			<mesh position={goldPos} castShadow>
				<sphereGeometry args={[0.07 + out * 0.18, 32, 32]} />
				<meshStandardMaterial color="#ffc300" emissive="#ff9f00" emissiveIntensity={0.25 + out * 0.4} metalness={0.5} roughness={0.25} />
			</mesh>
			<pointLight position={[0, 2, 3]} intensity={out * 4} color="#ffd56b" />
		</Stage>
	);
};
