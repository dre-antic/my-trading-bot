import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {Character} from './Character';
import {Bill, Coin, FloatingProp} from './Props';
import {projectToScreen, Stage, useLayoutScale, useSceneCamera, type CameraState} from './Stage';
import {fontFamily, Headline, Tag} from './Text';
import type {
	BarChartScene,
	BigNumberScene,
	CharacterSpec,
	CompareScene,
	LineChartScene,
	MoneyRainScene,
	SceneProps,
	TalkScene,
	TitleScene,
} from './types';

const seeded = (i: number) => {
	const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
};

const Person: React.FC<{spec: CharacterSpec; index: number; props: SceneProps; fallbackX?: number}> = ({
	spec,
	index,
	props,
	fallbackX = 0,
}) => {
	const xs = useLayoutScale();
	const talking = spec.talking ?? index === 0;
	const x = (spec.x ?? fallbackX) * xs;
	const pose = spec.pose === 'point' ? (x > 0.01 ? 'pointLeft' : 'pointRight') : spec.pose;
	return (
		<Character
			pose={pose}
			mood={spec.mood}
			style={spec.style ?? props.defaultStyle}
			color={spec.color ?? props.defaultColor}
			mouth={talking ? props.mouth : 0}
			position={[x, 0, spec.z ?? 0]}
			turn={spec.turn ?? 0}
			scale={spec.scale ?? 1}
			seed={index}
		>
			{spec.prop ? <FloatingProp name={spec.prop} position={[0.62, 2.45, 0.1]} /> : null}
		</Character>
	);
};

const CharacterTags: React.FC<{specs: CharacterSpec[]; cam: CameraState; props: SceneProps}> = ({specs, cam, props}) => {
	const {width, height} = useVideoConfig();
	const xs = useLayoutScale();
	return (
		<>
			{specs.map((s, i) => {
				if (!s.tag) return null;
				const p = projectToScreen([(s.x ?? 0) * xs, 2.55 * (s.scale ?? 1), s.z ?? 0], cam, width, height);
				return <Tag key={i} text={s.tag} x={p.x} y={p.y} theme={props.theme} delay={6 + i * 4} />;
			})}
		</>
	);
};

const spread = (n: number, gap = 1.8) => Array.from({length: n}, (_, i) => (i - (n - 1) / 2) * gap);

export const Talk: React.FC<SceneProps<TalkScene>> = (props) => {
	const {scene} = props;
	const cam = useSceneCamera(scene.camera, undefined, !!scene.headline);
	const xs = spread(scene.characters.length);
	return (
		<Stage
			theme={props.theme}
			cam={cam}
			overlay={
				<>
					{scene.headline ? <Headline text={scene.headline} theme={props.theme} /> : null}
					<CharacterTags specs={scene.characters.map((c, i) => ({...c, x: c.x ?? xs[i]}))} cam={cam} props={props} />
				</>
			}
		>
			{scene.characters.map((c, i) => (
				<Person key={i} spec={c} index={i} props={props} fallbackX={xs[i]} />
			))}
		</Stage>
	);
};

export const Title: React.FC<SceneProps<TitleScene>> = (props) => {
	const {scene, theme} = props;
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const cam = useSceneCamera(scene.camera ?? 'pull', [0, 1.85, 0]);
	const s = spring({frame: frame - 4, fps, config: {damping: 12, stiffness: 110}});
	const vertical = width < height;
	return (
		<Stage
			theme={theme}
			cam={cam}
			overlay={
				<AbsoluteFill style={{alignItems: 'center', paddingTop: height * (vertical ? 0.13 : 0.08)}}>
					<div
						style={{
							fontFamily,
							fontWeight: 900,
							fontSize: width * (vertical ? 0.095 : 0.06),
							color: theme.ink,
							textTransform: 'uppercase',
							textAlign: 'center',
							lineHeight: 1,
							maxWidth: width * 0.9,
							transform: `scale(${s})`,
						}}
					>
						{scene.title}
					</div>
					{scene.subtitle ? (
						<div
							style={{
								marginTop: 18,
								fontFamily,
								fontWeight: 700,
								fontSize: width * (vertical ? 0.04 : 0.022),
								color: '#fff',
								background: theme.accent,
								padding: '0.3em 0.9em',
								borderRadius: 999,
								opacity: interpolate(frame, [12, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
							}}
						>
							{scene.subtitle}
						</div>
					) : null}
				</AbsoluteFill>
			}
		>
			<Person spec={{pose: 'wave', mood: 'happy', scale: 0.8, ...scene.character}} index={0} props={props} />
		</Stage>
	);
};

const CoinRain: React.FC<{count?: number; bills?: boolean}> = ({count = 26, bills = false}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const xs = useLayoutScale();
	const t = frame / fps;
	return (
		<>
			{Array.from({length: count}).map((_, i) => {
				const speed = 1.4 + seeded(i) * 1.2;
				const start = seeded(i + 100) * 2.2;
				const life = (t * speed + start * speed) % 6.5;
				const y = 6 - life;
				const x = (seeded(i + 7) * 8 - 4) * xs;
				const z = -1.5 - seeded(i + 31) * 2.5;
				const r = t * (2 + seeded(i + 3) * 3);
				return bills ? (
					<Bill key={i} position={[x, Math.max(0.02, y), z]} rotation={[r, r * 0.6, Math.sin(r) * 0.6]} />
				) : (
					<Coin key={i} position={[x, Math.max(0.03, y), z]} spin={r} />
				);
			})}
		</>
	);
};

export const BigNumber: React.FC<SceneProps<BigNumberScene>> = (props) => {
	const {scene, theme} = props;
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const cam = useSceneCamera(scene.camera ?? 'push');
	const count = interpolate(frame, [4, Math.round(fps * 1.1)], [0, scene.value], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.cubic),
	});
	const s = spring({frame, fps, config: {damping: 10, stiffness: 120}});
	const formatted = count.toLocaleString('en-US', {
		minimumFractionDigits: scene.decimals ?? 0,
		maximumFractionDigits: scene.decimals ?? 0,
	});
	const vertical = width < height;
	const character: CharacterSpec = {pose: 'point', mood: 'happy', x: vertical ? 0 : -2.0, ...scene.character};
	return (
		<Stage
			theme={theme}
			cam={cam}
			overlay={
				<>
					{scene.headline ? <Headline text={scene.headline} theme={theme} /> : null}
					<AbsoluteFill
						style={{
							justifyContent: 'center',
							alignItems: 'center',
							paddingLeft: vertical ? 0 : width * 0.18,
							paddingBottom: vertical ? height * 0.25 : height * 0.12,
						}}
					>
						<div
							style={{
								fontFamily,
								fontWeight: 900,
								fontSize: width * (vertical ? 0.17 : 0.12),
								color: theme.ink,
								transform: `scale(${s}) rotate(${(1 - s) * -6}deg)`,
								letterSpacing: -3,
							}}
						>
							<span style={{color: theme.positive}}>{scene.prefix}</span>
							{formatted}
							<span style={{color: theme.positive}}>{scene.suffix}</span>
						</div>
						{scene.label ? (
							<div
								style={{
									fontFamily,
									fontWeight: 800,
									fontSize: width * (vertical ? 0.045 : 0.026),
									color: theme.ink,
									opacity: interpolate(frame, [14, 24], [0, 0.8], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
									textTransform: 'uppercase',
								}}
							>
								{scene.label}
							</div>
						) : null}
					</AbsoluteFill>
				</>
			}
		>
			{scene.coins !== false ? <CoinRain count={18} /> : null}
			<Person spec={character} index={0} props={props} />
		</Stage>
	);
};

export const BarChart: React.FC<SceneProps<BarChartScene>> = (props) => {
	const {scene, theme} = props;
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const xs = useLayoutScale();
	const vertical = width < height;
	const cam = useSceneCamera(scene.camera ?? 'push', [vertical ? 0 : 0.2, 1.25, 0], !!scene.headline);
	const max = Math.max(...scene.bars.map((b) => b.value));
	const gap = vertical ? 2.1 : Math.min(1.6, 3.8 / Math.max(1, scene.bars.length));
	const startX = (vertical ? 0 : 0.9) - ((scene.bars.length - 1) * gap) / 2;
	const maxH = 2.1;
	const bars = scene.bars.map((b, i) => {
		const g = spring({frame: frame - 6 - i * 5, fps, config: {damping: 15, stiffness: 90}});
		const h = Math.max(0.02, (b.value / max) * maxH * g);
		return {...b, h, x: startX + i * gap, g};
	});
	const character: CharacterSpec = {pose: 'point', mood: 'neutral', x: vertical ? 0 : -2.3, turn: 0.35, ...scene.character};
	return (
		<Stage
			theme={theme}
			cam={cam}
			overlay={
				<>
					{scene.headline ? <Headline text={scene.headline} theme={theme} /> : null}
					{bars.map((b, i) => {
						const edgeL = projectToScreen([(b.x - (gap * 0.34)) * xs, 0.4, 0.32], cam, width, height);
						const edgeR = projectToScreen([(b.x + (gap * 0.34)) * xs, 0.4, 0.32], cam, width, height);
						const barPx = Math.abs(edgeR.x - edgeL.x);
						const top = projectToScreen([b.x * xs, b.h + 0.08, 0], cam, width, height);
						const short = b.h < 0.5;
						const base = projectToScreen([b.x * xs, short ? b.h + 0.55 : b.h > 0.84 ? b.h * 0.5 : 0.42, 0.32], cam, width, height);
						return (
							<React.Fragment key={i}>
								<Tag text={b.display ?? String(b.value)} x={top.x} y={top.y} theme={theme} color={b.highlight ? theme.accent : undefined} delay={12 + i * 5} size={0.85} />
								<div
									style={{
										position: 'absolute',
										left: base.x,
										top: base.y,
										transform: 'translate(-50%, -50%)',
										fontFamily,
										fontWeight: 900,
										fontSize: width * (vertical ? 0.03 : 0.017),
										color: short ? theme.ink : '#ffffff',
										textShadow: short ? 'none' : '0 2px 6px rgba(0,0,0,0.25)',
										opacity: b.g,
										textAlign: 'center',
										lineHeight: 1.05,
										width: barPx * 0.9,
									}}
								>
									{b.label}
								</div>
							</React.Fragment>
						);
					})}
				</>
			}
		>
			{bars.map((b, i) => (
				<mesh key={i} position={[b.x * xs, b.h / 2, 0]} castShadow>
					<boxGeometry args={[gap * xs * 0.68, b.h, 0.62]} />
					<meshStandardMaterial color={b.highlight ? theme.accent : theme.positive} roughness={0.45} />
				</mesh>
			))}
			{vertical ? null : <Person spec={character} index={0} props={props} />}
		</Stage>
	);
};

export const LineChart: React.FC<SceneProps<LineChartScene>> = (props) => {
	const {scene, theme} = props;
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const vertical = width < height;
	const cam = useSceneCamera(scene.camera ?? 'still');
	const progress = interpolate(frame, [6, fps * 1.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad)});
	const W = vertical ? width * 0.8 : width * 0.52;
	const H = vertical ? height * 0.3 : height * 0.5;
	const min = Math.min(...scene.points);
	const max = Math.max(...scene.points);
	const pts = scene.points.map((v, i) => [
		(i / (scene.points.length - 1)) * W,
		H - ((v - min) / Math.max(1e-6, max - min)) * H * 0.9 - H * 0.05,
	]);
	const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
	const len = pts.reduce((acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])), 0);
	const mark = scene.markAt !== undefined ? pts[scene.markAt] : undefined;
	const markOn = scene.markAt !== undefined && progress >= scene.markAt / (scene.points.length - 1);
	const panelIn = spring({frame, fps, config: {damping: 14}});
	const character: CharacterSpec = {pose: 'point', mood: 'neutral', x: vertical ? 0 : 2.6, turn: -0.4, ...scene.character};
	return (
		<Stage
			theme={theme}
			cam={cam}
			overlay={
				<>
					{scene.headline ? <Headline text={scene.headline} theme={theme} /> : null}
					<div
						style={{
							position: 'absolute',
							left: vertical ? (width - W) / 2 - 30 : width * 0.08,
							top: vertical ? height * 0.27 : height * 0.22,
							width: W + 60,
							height: H + 70,
							background: theme.panel,
							borderRadius: 28,
							boxShadow: '0 20px 50px rgba(0,0,0,0.12)',
							transform: `scale(${panelIn})`,
							transformOrigin: 'center',
						}}
					>
						<svg width={W} height={H} style={{position: 'absolute', left: 30, top: 25, overflow: 'visible'}}>
							<line x1={0} y1={H} x2={W} y2={H} stroke={theme.ink} strokeOpacity={0.25} strokeWidth={3} />
							<line x1={0} y1={0} x2={0} y2={H} stroke={theme.ink} strokeOpacity={0.25} strokeWidth={3} />
							<path d={d} fill="none" stroke={theme.positive} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - progress)} />
							{mark && markOn ? (
								<g>
									<line x1={mark[0]} y1={mark[1]} x2={mark[0]} y2={H} stroke={theme.accent} strokeWidth={4} strokeDasharray="10 8" />
									<circle cx={mark[0]} cy={mark[1]} r={16} fill={theme.accent} stroke="#fff" strokeWidth={5} />
								</g>
							) : null}
						</svg>
						{mark && markOn && scene.markLabel ? (
							<Tag text={scene.markLabel} x={30 + mark[0]} y={25 + mark[1] - 26} theme={theme} color={theme.accent} />
						) : null}
						<div style={{position: 'absolute', bottom: 10, width: '100%', textAlign: 'center', fontFamily, fontWeight: 700, fontSize: width * 0.014, color: theme.ink, opacity: 0.6}}>
							{scene.xLabel}
						</div>
						<div
							style={{
								position: 'absolute',
								left: -8,
								top: '50%',
								transform: 'translate(-50%, -50%) rotate(-90deg)',
								fontFamily,
								fontWeight: 700,
								fontSize: width * 0.014,
								color: theme.ink,
								opacity: 0.6,
								whiteSpace: 'nowrap',
							}}
						>
							{scene.yLabel}
						</div>
					</div>
				</>
			}
		>
			{vertical ? null : <Person spec={character} index={0} props={props} />}
		</Stage>
	);
};

export const MoneyRain: React.FC<SceneProps<MoneyRainScene>> = (props) => {
	const {scene, theme} = props;
	const cam = useSceneCamera(scene.camera ?? 'push', undefined, !!scene.headline);
	const chars = scene.characters ?? [{pose: 'cheer', mood: 'happy'}];
	const xs = spread(chars.length);
	return (
		<Stage
			theme={theme}
			cam={cam}
			overlay={
				<>
					{scene.headline ? <Headline text={scene.headline} theme={theme} /> : null}
					<CharacterTags specs={chars.map((c, i) => ({...c, x: c.x ?? xs[i]}))} cam={cam} props={props} />
				</>
			}
		>
			<CoinRain count={30} bills />
			<CoinRain count={10} />
			{chars.map((c, i) => (
				<Person key={i} spec={c} index={i} props={props} fallbackX={xs[i]} />
			))}
		</Stage>
	);
};

export const Compare: React.FC<SceneProps<CompareScene>> = (props) => {
	const {scene, theme} = props;
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const cam = useSceneCamera(scene.camera ?? 'push', [0, 1.4, 0], !!scene.headline);
	const xs = useLayoutScale();
	const vertical = width < height;
	const lx = vertical ? -2.4 : -1.9;
	const rx = -lx;
	const left: CharacterSpec = {pose: 'idle', mood: 'happy', x: lx, turn: 0.25, talking: true, ...scene.left.character};
	const right: CharacterSpec = {pose: 'think', mood: 'neutral', x: rx, turn: -0.25, talking: false, ...scene.right.character};
	const vs = spring({frame: frame - 10, fps, config: {damping: 9, stiffness: 160}});
	const lp = projectToScreen([lx * xs, 2.65, 0], cam, width, height);
	const rp = projectToScreen([rx * xs, 2.65, 0], cam, width, height);
	return (
		<Stage
			theme={theme}
			cam={cam}
			overlay={
				<>
					{scene.headline ? <Headline text={scene.headline} theme={theme} /> : null}
					<Tag text={scene.left.label} x={lp.x} y={lp.y} theme={theme} color={theme.positive} delay={4} size={vertical ? 1.5 : 1.15} />
					<Tag text={scene.right.label} x={rp.x} y={rp.y} theme={theme} color={theme.accent} delay={10} size={vertical ? 1.5 : 1.15} />
					{scene.versus !== false ? (
						<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', paddingBottom: height * 0.1}}>
							<div
								style={{
									fontFamily,
									fontWeight: 900,
									fontSize: width * (vertical ? 0.1 : 0.05),
									color: theme.negative,
									transform: `scale(${vs}) rotate(-8deg)`,
								}}
							>
								VS
							</div>
						</AbsoluteFill>
					) : null}
				</>
			}
		>
			{[-1, 1].map((s) => (
				<mesh key={s} position={[s * rx * xs, 0.05, 0]} receiveShadow castShadow>
					<cylinderGeometry args={[0.75, 0.8, 0.1, 40]} />
					<meshStandardMaterial color={s < 0 ? theme.positive : theme.accent} roughness={0.5} />
				</mesh>
			))}
			<group position={[0, 0.1, 0]}>
				<Person spec={left} index={0} props={props} />
				<Person spec={right} index={1} props={props} />
			</group>
		</Stage>
	);
};
