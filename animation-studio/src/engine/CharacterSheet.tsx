import React from 'react';
import {useVideoConfig} from 'remotion';
import {Character} from './Character';
import {projectToScreen, Stage, type CameraState} from './Stage';
import {fontFamily, Tag} from './Text';
import {resolveTheme} from './theme';
import type {CharacterStyle, Mood, Pose} from './types';

const LINEUP: {style: CharacterStyle; color: string; pose: Pose; mood: Mood; label: string}[] = [
	{style: 'mannequin', color: '#4c6ef5', pose: 'wave', mood: 'happy', label: 'mannequin · blue'},
	{style: 'mannequin', color: '#2fb36d', pose: 'point', mood: 'neutral', label: 'mannequin · green'},
	{style: 'stick', color: '#1c1b22', pose: 'shrug', mood: 'shocked', label: 'stick'},
	{style: 'suit', color: '#22304a', pose: 'present', mood: 'happy', label: 'suit · navy'},
	{style: 'suit', color: '#7b2cbf', pose: 'think', mood: 'neutral', label: 'suit · purple'},
	{style: 'mannequin', color: '#e5484d', pose: 'sad', mood: 'sad', label: 'mannequin · red'},
];

/** Still frame showing every built-in character style, used to pick a look for a channel. */
export const CharacterSheet: React.FC<{theme?: string}> = ({theme: themeName}) => {
	const theme = resolveTheme(themeName);
	const {width, height} = useVideoConfig();
	const cam: CameraState = {position: [0, 1.9, 11], target: [0, 1.2, 0], fov: 34};
	const xs = LINEUP.map((_, i) => (i - (LINEUP.length - 1) / 2) * 1.75);
	return (
		<Stage
			theme={theme}
			cam={cam}
			overlay={
				<>
					<div style={{position: 'absolute', top: 60, width: '100%', textAlign: 'center', fontFamily, fontWeight: 900, fontSize: 64, color: theme.ink}}>
						CHARACTER STYLES
					</div>
					{LINEUP.map((c, i) => {
						const p = projectToScreen([xs[i], -0.15, 0.6], cam, width, height);
						return <Tag key={i} text={c.label} x={p.x} y={p.y + 50} theme={theme} />;
					})}
				</>
			}
		>
			{LINEUP.map((c, i) => (
				<Character key={i} style={c.style} color={c.color} pose={c.pose} mood={c.mood} position={[xs[i], 0, 0]} seed={i} />
			))}
		</Stage>
	);
};
