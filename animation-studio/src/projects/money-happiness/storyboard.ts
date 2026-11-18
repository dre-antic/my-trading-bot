import type {Caption} from '@remotion/captions';
import type {Storyboard} from '../../engine/types';
import captions from './captions.json';

export const moneyHappiness: Storyboard = {
	id: 'MoneyHappiness',
	title: 'Can Money Buy Happiness?',
	width: 1920,
	height: 1080,
	fps: 30,
	audio: 'projects/money-happiness/voiceover.mp3',
	captions: captions as Caption[],
	theme: 'cream',
	characterStyle: 'mannequin',
	characterColor: '#4c6ef5',
	scenes: [
		{type: 'title', from: 0, to: 4.52, title: 'Can money buy happiness?', subtitle: 'The $75,000 myth', sfx: 'pop'},
		{type: 'bigNumber', from: 4.52, to: 6.96, value: 75000, prefix: '$', label: 'per year', sfx: ['whoosh', 'cash']},
		{
			type: 'lineChart',
			from: 6.96,
			to: 12.6,
			headline: 'The happiness plateau',
			points: [10, 32, 50, 63, 72, 76, 77, 77, 77, 77],
			markAt: 5,
			markLabel: '$75k',
			xLabel: 'Income',
			yLabel: 'Happiness',
			sfx: ['whoosh', 'ding'],
		},
		{
			type: 'talk',
			from: 12.6,
			to: 16.2,
			headline: 'Your feelings had a salary cap',
			camera: 'push',
			characters: [{pose: 'shrug', mood: 'shocked', prop: 'moneyBag'}],
		},
		{
			type: 'talk',
			from: 16.2,
			to: 20.64,
			headline: 'Then someone checked again',
			camera: 'panRight',
			characters: [
				{pose: 'think', mood: 'neutral', x: -1.4, turn: 0.3, tag: 'Researcher A', talking: false, style: 'suit', color: '#22304a'},
				{pose: 'point', mood: 'angry', x: 1.4, turn: -0.3, tag: 'Researcher B', talking: true, style: 'suit', color: '#7b2cbf'},
			],
		},
		{
			type: 'talk',
			from: 20.64,
			to: 24.64,
			headline: 'Rivals team up',
			camera: 'orbit',
			characters: [
				{pose: 'cheer', mood: 'happy', x: -0.9, style: 'suit', color: '#22304a'},
				{pose: 'cheer', mood: 'happy', x: 0.9, style: 'suit', color: '#7b2cbf', prop: 'lightbulb', talking: false},
			],
			sfx: ['whoosh', 'ding'],
		},
		{
			type: 'barChart',
			from: 24.64,
			to: 30.2,
			headline: 'Which happiness?',
			bars: [
				{label: '$30k', value: 52, display: '52'},
				{label: '$60k', value: 64, display: '64'},
				{label: '$100k', value: 71, display: '71'},
				{label: '$200k', value: 78, display: '78', highlight: true},
			],
		},
		{
			type: 'compare',
			from: 30.2,
			to: 34.6,
			left: {label: 'How you feel', character: {pose: 'cheer', mood: 'happy', prop: 'heart'}},
			right: {label: 'How you rate life', character: {pose: 'think', mood: 'neutral', prop: 'question'}},
			sfx: ['whoosh', 'pop'],
		},
	],
};
