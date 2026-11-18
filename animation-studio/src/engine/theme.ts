export type Theme = {
	background: string;
	floorShadow: number;
	ink: string;
	accent: string;
	positive: string;
	negative: string;
	panel: string;
	captionColor: string;
	captionHighlight: string;
	captionStroke: string;
};

export const defaultTheme: Theme = {
	background: '#f3efe6',
	floorShadow: 0.2,
	ink: '#1c1b22',
	accent: '#ffb703',
	positive: '#2fb36d',
	negative: '#e5484d',
	panel: '#ffffff',
	captionColor: '#ffffff',
	captionHighlight: '#ffd23f',
	captionStroke: '#111111',
};

export const themes: Record<string, Partial<Theme>> = {
	cream: {},
	night: {
		background: '#151722',
		floorShadow: 0.45,
		ink: '#f5f5f7',
		panel: '#22263a',
	},
	mint: {
		background: '#dff3ea',
		accent: '#ff7a59',
	},
	sky: {
		background: '#dcecff',
		accent: '#ff5d8f',
	},
};

export const resolveTheme = (theme?: string | Partial<Theme>): Theme => {
	if (!theme) return defaultTheme;
	if (typeof theme === 'string') return {...defaultTheme, ...(themes[theme] ?? {})};
	return {...defaultTheme, ...theme};
};
