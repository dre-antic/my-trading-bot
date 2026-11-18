import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {resolveTheme} from './theme';
import {Captions, mouthAt} from './Text';
import {BarChart, BigNumber, Compare, LineChart, MoneyRain, Talk, Title} from './scenes';
import type {Scene, SceneProps, SfxName, Storyboard} from './types';

const SFX_VOLUME: Record<SfxName, number> = {whoosh: 0.35, pop: 0.5, ding: 0.4, cash: 0.45, boom: 0.5, tick: 0.35};

const SceneSwitch: React.FC<SceneProps & {storyboard: Storyboard}> = ({storyboard, ...props}) => {
	const s = props.scene;
	switch (s.type) {
		case 'talk':
			return <Talk {...props} scene={s} />;
		case 'title':
			return <Title {...props} scene={s} />;
		case 'bigNumber':
			return <BigNumber {...props} scene={s} />;
		case 'barChart':
			return <BarChart {...props} scene={s} />;
		case 'lineChart':
			return <LineChart {...props} scene={s} />;
		case 'moneyRain':
			return <MoneyRain {...props} scene={s} />;
		case 'compare':
			return <Compare {...props} scene={s} />;
		case 'custom': {
			const C = storyboard.customScenes?.[s.component];
			if (!C) throw new Error(`Custom scene "${s.component}" is not registered in customScenes`);
			return <C {...props} scene={s} />;
		}
		default:
			throw new Error(`Unknown scene type: ${(s as Scene).type}`);
	}
};

const Transition: React.FC<{children: React.ReactNode}> = ({children}) => {
	const frame = useCurrentFrame();
	const opacity = interpolate(frame, [0, 6], [0, 1], {extrapolateRight: 'clamp'});
	const scale = interpolate(frame, [0, 8], [1.06, 1], {extrapolateRight: 'clamp'});
	return <AbsoluteFill style={{opacity, transform: `scale(${scale})`}}>{children}</AbsoluteFill>;
};

const Mouth: React.FC<{storyboard: Storyboard; offset: number; children: (mouth: number) => React.ReactNode}> = ({
	storyboard,
	offset,
	children,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return <>{children(mouthAt(storyboard.captions, frame + offset, fps))}</>;
};

export const storyboardDuration = (sb: Storyboard) => {
	const fps = sb.fps ?? 30;
	const end = Math.max(...sb.scenes.map((s) => s.to), 1) + (sb.tail ?? 0.5);
	return Math.ceil(end * fps);
};

export const Video: React.FC<{storyboard: Storyboard}> = ({storyboard}) => {
	const {fps} = useVideoConfig();
	const theme = resolveTheme(storyboard.theme);
	const defaultStyle = storyboard.characterStyle ?? 'mannequin';
	const defaultColor = storyboard.characterColor ?? '#4c6ef5';
	return (
		<AbsoluteFill style={{backgroundColor: theme.background}}>
			{storyboard.scenes.map((scene, i) => {
				const from = Math.round(scene.from * fps);
				const next = storyboard.scenes[i + 1];
				const to = Math.round((next && next.from < scene.to ? next.from : scene.to) * fps);
				const sfx = scene.sfx === undefined ? (i === 0 ? [] : ['whoosh' as SfxName]) : ([] as SfxName[]).concat(scene.sfx);
				return (
					<Sequence key={i} from={from} durationInFrames={Math.max(1, to - from)} name={`${i + 1}. ${scene.type}`}>
						<Transition>
							<Mouth storyboard={storyboard} offset={from}>
								{(mouth) => (
									<SceneSwitch
										storyboard={storyboard}
										scene={scene}
										theme={theme}
										defaultStyle={defaultStyle}
										defaultColor={defaultColor}
										mouth={mouth}
									/>
								)}
							</Mouth>
						</Transition>
						{sfx.map((name, k) => (
							<Audio key={k} src={staticFile(`sfx/${name}.wav`)} volume={SFX_VOLUME[name]} />
						))}
					</Sequence>
				);
			})}
			{storyboard.audio ? <Audio src={staticFile(storyboard.audio)} /> : null}
			{storyboard.captions && storyboard.showCaptions !== false ? <Captions captions={storyboard.captions} theme={theme} /> : null}
		</AbsoluteFill>
	);
};
