import React, {useMemo} from 'react';
import {loadFont} from '@remotion/google-fonts/Montserrat';
import {createTikTokStyleCaptions, type Caption} from '@remotion/captions';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Theme} from './theme';

export const {fontFamily} = loadFont('normal', {weights: ['600', '800', '900'], subsets: ['latin']});

const stroke = (color: string, px: number) =>
	`${px}px ${px}px 0 ${color}, -${px}px ${px}px 0 ${color}, ${px}px -${px}px 0 ${color}, -${px}px -${px}px 0 ${color}, 0 ${px * 1.6}px 0 ${color}`;

export const Headline: React.FC<{text: string; theme: Theme}> = ({text, theme}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const s = spring({frame, fps, config: {damping: 13, stiffness: 140}});
	const vertical = width < height;
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: height * (vertical ? 0.14 : 0.07), pointerEvents: 'none'}}>
			<div
				style={{
					fontFamily,
					fontWeight: 900,
					fontSize: Math.round(width * (vertical ? 0.075 : 0.042)),
					color: theme.ink,
					textAlign: 'center',
					lineHeight: 1.08,
					maxWidth: width * 0.86,
					letterSpacing: -0.5,
					textTransform: 'uppercase',
					transform: `translateY(${(1 - s) * -40}px) scale(${0.9 + s * 0.1})`,
					opacity: s,
				}}
			>
				{text}
			</div>
		</AbsoluteFill>
	);
};

/** A pill-shaped label pinned to a pixel position (usually from `projectToScreen`). */
export const Tag: React.FC<{text: string; x: number; y: number; theme: Theme; color?: string; delay?: number; size?: number}> = ({
	text,
	x,
	y,
	theme,
	color,
	delay = 0,
	size = 1,
}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const s = spring({frame: frame - delay, fps, config: {damping: 12, stiffness: 160}});
	const base = width < height ? 0.034 : 0.02;
	return (
		<div
			style={{
				position: 'absolute',
				left: x,
				top: y,
				transform: `translate(-50%, -100%) scale(${s})`,
				fontFamily,
				fontWeight: 800,
				fontSize: Math.round(width * base * size),
				color: color ? '#fff' : theme.ink,
				background: color ?? theme.panel,
				padding: `${0.35 * size}em ${0.8 * size}em`,
				borderRadius: 999,
				boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
				whiteSpace: 'nowrap',
			}}
		>
			{text}
		</div>
	);
};

export const Captions: React.FC<{captions: Caption[]; theme: Theme}> = ({captions, theme}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const nowMs = (frame / fps) * 1000;
	const {pages} = useMemo(
		() => createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds: 900}),
		[captions],
	);
	const page = pages.find((p) => nowMs >= p.startMs && nowMs < p.startMs + p.durationMs);
	if (!page) return null;
	const pageFrame = Math.round(((nowMs - page.startMs) / 1000) * fps);
	const pop = spring({frame: pageFrame, fps, config: {damping: 14, stiffness: 220}, durationInFrames: 8});
	const vertical = width < height;
	return (
		<AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * (vertical ? 0.24 : 0.08), pointerEvents: 'none'}}>
			<div
				style={{
					fontFamily,
					fontWeight: 900,
					fontSize: Math.round(width * (vertical ? 0.07 : 0.04)),
					textAlign: 'center',
					maxWidth: width * 0.84,
					lineHeight: 1.15,
					textTransform: 'uppercase',
					transform: `scale(${interpolate(pop, [0, 1], [0.85, 1])})`,
					whiteSpace: 'pre-wrap',
				}}
			>
				{page.tokens.map((tok, i) => {
					const active = nowMs >= tok.fromMs && nowMs < tok.toMs;
					return (
						<span
							key={i}
							style={{
								color: active ? theme.captionHighlight : theme.captionColor,
								textShadow: stroke(theme.captionStroke, Math.max(2, Math.round(width / 480))),
							}}
						>
							{tok.text}
						</span>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

/** 0..1 mouth openness driven by whether a caption word is being spoken right now. */
export const mouthAt = (captions: Caption[] | undefined, frame: number, fps: number) => {
	if (!captions?.length) return 0;
	const ms = (frame / fps) * 1000;
	const word = captions.find((c) => ms >= c.startMs && ms < c.endMs);
	if (!word) return 0;
	const t = (ms - word.startMs) / Math.max(60, word.endMs - word.startMs);
	return 0.35 + 0.65 * Math.abs(Math.sin(t * Math.PI * Math.max(1, Math.round(word.text.length / 3))));
};
