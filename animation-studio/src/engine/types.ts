import type {Caption} from '@remotion/captions';
import type {Theme} from './theme';

export type Pose =
	| 'idle'
	| 'wave'
	/** Points toward the middle of the frame (direction picked from the character's x). */
	| 'point'
	| 'pointLeft'
	| 'pointRight'
	| 'shrug'
	| 'cheer'
	| 'think'
	| 'sad'
	| 'walk'
	| 'present';

export type Mood = 'neutral' | 'happy' | 'sad' | 'shocked' | 'angry';

export type CharacterStyle = 'mannequin' | 'stick' | 'suit';

export type CharacterSpec = {
	pose?: Pose;
	mood?: Mood;
	/** Horizontal position in world units. Roughly -3..3 in 16:9. */
	x?: number;
	/** Depth. Negative is further from the camera. */
	z?: number;
	/** Y-rotation in radians. Positive turns the character to its left. */
	turn?: number;
	style?: CharacterStyle;
	color?: string;
	scale?: number;
	/** Mouth moves with the voiceover while true. Defaults to true for the first character only. */
	talking?: boolean;
	/** Text shown floating above the character's head. */
	tag?: string;
	/** Small object held or shown next to the character. */
	prop?: PropName;
};

export type PropName = 'coin' | 'cash' | 'moneyBag' | 'house' | 'heart' | 'question' | 'lightbulb';

export type SfxName = 'whoosh' | 'pop' | 'ding' | 'cash' | 'boom' | 'tick';

export type CameraMove = 'push' | 'pull' | 'panLeft' | 'panRight' | 'still' | 'orbit';

type SceneCommon = {
	/** Start time in seconds on the voiceover timeline. */
	from: number;
	/** End time in seconds. */
	to: number;
	/** Big headline shown at the top of the frame. */
	headline?: string;
	camera?: CameraMove;
	sfx?: SfxName | SfxName[];
	/** A stamp that slams onto the frame a beat after the scene starts, e.g. "NO SOURCE". */
	stamp?: string;
};

export type TalkScene = SceneCommon & {
	type: 'talk';
	characters: CharacterSpec[];
};

export type TitleScene = SceneCommon & {
	type: 'title';
	title: string;
	subtitle?: string;
	character?: CharacterSpec;
};

export type BigNumberScene = SceneCommon & {
	type: 'bigNumber';
	value: number;
	prefix?: string;
	suffix?: string;
	label?: string;
	decimals?: number;
	character?: CharacterSpec;
	/** Coins rain down behind the number. */
	coins?: boolean;
};

export type BarChartScene = SceneCommon & {
	type: 'barChart';
	bars: {label: string; value: number; highlight?: boolean; display?: string}[];
	character?: CharacterSpec;
};

export type LineChartScene = SceneCommon & {
	type: 'lineChart';
	/** Y values, any scale. Plotted left to right. */
	points: number[];
	xLabel?: string;
	yLabel?: string;
	/** Index of a point to call out with a marker. */
	markAt?: number;
	markLabel?: string;
	character?: CharacterSpec;
};

export type MoneyRainScene = SceneCommon & {
	type: 'moneyRain';
	characters?: CharacterSpec[];
};

export type CompareScene = SceneCommon & {
	type: 'compare';
	left: {label: string; character?: CharacterSpec};
	right: {label: string; character?: CharacterSpec};
	versus?: boolean;
};

export type CustomScene = SceneCommon & {
	type: 'custom';
	/** Key in `customScenes` passed to the storyboard. */
	component: string;
	props?: Record<string, unknown>;
};

export type Scene =
	| TalkScene
	| TitleScene
	| BigNumberScene
	| BarChartScene
	| LineChartScene
	| MoneyRainScene
	| CompareScene
	| CustomScene;

export type SceneProps<S extends Scene = Scene> = {
	scene: S;
	theme: Theme;
	defaultStyle: CharacterStyle;
	defaultColor: string;
	/** 0..1 mouth openness for talking characters on this frame. */
	mouth: number;
};

export type Storyboard = {
	id: string;
	title: string;
	width?: number;
	height?: number;
	fps?: number;
	/** Path inside `public/`, e.g. `projects/my-video/voiceover.mp3`. */
	audio?: string;
	captions?: Caption[];
	showCaptions?: boolean;
	theme?: string | Partial<Theme>;
	characterStyle?: CharacterStyle;
	characterColor?: string;
	scenes: Scene[];
	customScenes?: Record<string, React.FC<SceneProps<CustomScene>>>;
	/** Extra seconds after the last scene before the video ends. */
	tail?: number;
};
