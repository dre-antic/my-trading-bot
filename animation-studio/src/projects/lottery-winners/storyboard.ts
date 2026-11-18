import type {Caption} from '@remotion/captions';
import type {Storyboard} from '../../engine/types';
import captions from './captions.json';
import {LotteryBalls, ShrinkingPile} from './scenes';

// Sources:
// - NEFE on the "70% of lottery winners go broke" claim: it says the figure is not from its research (2018 statement).
// - Hankins, Hoekstra & Skiba (2011), "The Ticket to Easy Street? The Financial Consequences of Winning the Lottery",
//   Review of Economics and Statistics. Florida winners of $50k-$150k vs. under $10k.
// - Lindqvist, Östling & Cesarini (2020), "Long-Run Effects of Lottery Wealth on Psychological Well-Being",
//   Review of Economic Studies. Swedish winners, life satisfaction 5-22 years after winning.
// - Powerball jackpot odds: 1 in 292,201,338.
// The bar and line charts show the direction of those findings, not exact figures.

export const lotteryWinners: Storyboard = {
	id: 'LotteryWinners',
	title: 'Do Lottery Winners Really Go Broke?',
	width: 1920,
	height: 1080,
	fps: 30,
	audio: 'projects/lottery-winners/voiceover.mp3',
	captions: captions as Caption[],
	theme: 'cream',
	characterStyle: 'mannequin',
	characterColor: '#4c6ef5',
	customScenes: {ShrinkingPile, LotteryBalls},
	scenes: [
		{type: 'title', from: 0, to: 1.91, title: 'Do lottery winners really go broke?', character: {pose: 'think', mood: 'neutral', prop: 'question'}, sfx: 'pop'},
		{type: 'moneyRain', from: 1.91, to: 4.29, headline: 'Millions. Overnight.', characters: [{pose: 'cheer', mood: 'happy'}], sfx: ['whoosh', 'cash']},
		{type: 'talk', from: 4.29, to: 6.24, headline: '...then losing it all', camera: 'pull', characters: [{pose: 'sad', mood: 'sad'}], sfx: ['whoosh', 'boom']},
		{type: 'bigNumber', from: 6.24, to: 11.36, value: 70, suffix: '%', label: 'of winners go broke?', coins: false, character: {pose: 'point', mood: 'shocked'}, sfx: ['whoosh', 'pop']},
		{
			type: 'talk',
			from: 11.36,
			to: 14.72,
			headline: 'The most repeated money "fact"',
			characters: [
				{pose: 'point', mood: 'happy', x: -1.4, tag: 'The internet', turn: 0.3},
				{pose: 'idle', mood: 'shocked', x: 1.4, turn: -0.3, talking: false},
			],
		},
		{type: 'talk', from: 14.72, to: 19.25, headline: 'Nobody can find the study', camera: 'push', characters: [{pose: 'shrug', mood: 'shocked', prop: 'question'}], sfx: ['whoosh', 'ding']},
		{
			type: 'talk',
			from: 19.25,
			to: 26.59,
			headline: '"Not from our research"',
			camera: 'panRight',
			characters: [{pose: 'present', mood: 'neutral', style: 'suit', color: '#22304a', tag: 'Nat. Endowment for Financial Education'}],
		},
		{type: 'title', from: 26.59, to: 29.73, title: 'So what really happens?', subtitle: 'The actual data', character: {pose: 'think', prop: 'lightbulb'}},
		{
			type: 'talk',
			from: 29.73,
			to: 33.43,
			headline: 'Florida: thousands of winners',
			characters: [
				{pose: 'idle', mood: 'happy', x: -2.2, prop: 'moneyBag', talking: false},
				{pose: 'wave', mood: 'happy', x: 0, prop: 'cash'},
				{pose: 'idle', mood: 'happy', x: 2.2, prop: 'coin', talking: false},
			],
			sfx: ['whoosh', 'pop'],
		},
		{
			type: 'compare',
			from: 33.43,
			to: 41.19,
			left: {label: 'Won up to $150,000', character: {pose: 'cheer', mood: 'happy', prop: 'moneyBag'}},
			right: {label: 'Won under $10,000', character: {pose: 'idle', mood: 'neutral', prop: 'coin'}},
		},
		{
			type: 'barChart',
			from: 41.19,
			to: 46.32,
			headline: 'Bankruptcy: first 2 years',
			bars: [
				{label: 'Big winners', value: 45, display: 'Fewer', highlight: true},
				{label: 'Small winners', value: 75, display: 'More'},
			],
			character: {pose: 'point', mood: 'happy'},
		},
		{
			type: 'barChart',
			from: 46.32,
			to: 50.92,
			headline: 'Bankruptcy: 5 years later',
			bars: [
				{label: 'Big winners', value: 74, display: 'About the same', highlight: true},
				{label: 'Small winners', value: 76, display: 'About the same'},
			],
			character: {pose: 'shrug', mood: 'shocked'},
			sfx: ['whoosh', 'boom'],
		},
		{type: 'talk', from: 50.92, to: 54.25, headline: 'The money only delayed it', characters: [{pose: 'sad', mood: 'sad', prop: 'cash'}]},
		{type: 'talk', from: 54.25, to: 57.63, headline: "A windfall doesn't change habits", camera: 'push', characters: [{pose: 'think', mood: 'neutral', prop: 'lightbulb'}], sfx: ['whoosh', 'ding']},
		{type: 'custom', component: 'ShrinkingPile', from: 57.63, to: 61.27, headline: 'Bigger pile, longer burn', props: {startFill: 1, endFill: 0.7}},
		{
			type: 'custom',
			component: 'ShrinkingPile',
			from: 61.27,
			to: 70.08,
			headline: 'Each one feels tiny',
			props: {
				startFill: 0.7,
				endFill: 0.12,
				items: [
					{kind: 'car', label: 'New car', at: 0},
					{kind: 'house', label: 'Bigger house', at: 1.77},
					{kind: 'loan', label: 'Loan to a friend', at: 2.99},
				],
			},
			sfx: ['whoosh', 'cash'],
		},
		{type: 'talk', from: 70.08, to: 72.05, headline: "Here's the twist", camera: 'pull', characters: [{pose: 'point', mood: 'shocked', x: 0}], sfx: ['whoosh', 'boom']},
		{
			type: 'talk',
			from: 72.05,
			to: 76.32,
			headline: 'Sweden: 10+ years of winners',
			camera: 'orbit',
			characters: [
				{pose: 'idle', mood: 'happy', x: -1.6, talking: false, color: '#ffb703'},
				{pose: 'present', mood: 'happy', x: 0, style: 'suit', color: '#22304a', tag: 'Researchers'},
				{pose: 'idle', mood: 'happy', x: 1.6, talking: false, color: '#2fb36d'},
			],
		},
		{
			type: 'lineChart',
			from: 76.32,
			to: 80.94,
			headline: 'Still more satisfied',
			points: [50, 61, 63, 62, 63, 62, 63, 63, 62, 63, 63],
			markAt: 10,
			markLabel: '10 years later',
			xLabel: 'Years after winning',
			yLabel: 'Life satisfaction',
			sfx: ['whoosh', 'ding'],
		},
		{
			type: 'compare',
			from: 80.94,
			to: 88.57,
			left: {label: 'Day to day: about the same', character: {pose: 'idle', mood: 'neutral', talking: true}},
			right: {label: 'Life overall: better', character: {pose: 'cheer', mood: 'happy', prop: 'heart'}},
			versus: false,
		},
		{type: 'talk', from: 88.57, to: 91.12, headline: 'Money is an amplifier', camera: 'push', characters: [{pose: 'present', mood: 'happy', prop: 'lightbulb'}], sfx: ['whoosh', 'ding']},
		{
			type: 'compare',
			from: 91.12,
			to: 95.2,
			left: {label: 'Good habits: bigger', character: {pose: 'cheer', mood: 'happy', prop: 'moneyBag', scale: 1.15}},
			right: {label: 'Bad habits: bigger too', character: {pose: 'sad', mood: 'sad', prop: 'cash', scale: 1.15}},
			versus: false,
		},
		{type: 'custom', component: 'LotteryBalls', from: 95.2, to: 100.32, headline: 'Powerball jackpot odds', props: {label: '1 in 292,000,000'}, sfx: ['whoosh', 'tick']},
		{type: 'talk', from: 100.32, to: 103.98, headline: 'Build wealth the slow way', camera: 'panRight', characters: [{pose: 'walk', mood: 'happy', prop: 'coin'}]},
		{
			type: 'barChart',
			from: 103.98,
			to: 108.06,
			headline: 'Spend less. Invest. Repeat.',
			bars: [
				{label: 'Year 1', value: 8, display: '$'},
				{label: 'Year 5', value: 22, display: '$$'},
				{label: 'Year 10', value: 45, display: '$$$'},
				{label: 'Year 20', value: 100, display: '$$$$', highlight: true},
			],
			character: {pose: 'point', mood: 'happy'},
			sfx: ['whoosh', 'cash'],
		},
		{type: 'talk', from: 108.06, to: 109.83, headline: 'Boring. But it works.', characters: [{pose: 'cheer', mood: 'happy'}], sfx: ['whoosh', 'ding']},
		{
			type: 'talk',
			from: 109.83,
			to: 117.5,
			headline: 'Where is the source?',
			camera: 'push',
			characters: [
				{pose: 'point', mood: 'neutral', x: -1.3, turn: 0.3, prop: 'question'},
				{pose: 'shrug', mood: 'shocked', x: 1.3, turn: -0.3, tag: '"70% go broke!"', talking: false},
			],
		},
	],
};
