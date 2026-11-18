import React from 'react';
import {Composition, Still} from 'remotion';
import {CharacterSheet} from './engine/CharacterSheet';
import {storyboardDuration, Video} from './engine/Video';
import {projects} from './projects';

export const Root: React.FC = () => (
	<>
		{projects.map((sb) => (
			<Composition
				key={sb.id}
				id={sb.id}
				component={Video}
				defaultProps={{storyboard: sb}}
				durationInFrames={storyboardDuration(sb)}
				fps={sb.fps ?? 30}
				width={sb.width ?? 1920}
				height={sb.height ?? 1080}
			/>
		))}
		<Still id="CharacterSheet" component={CharacterSheet} width={1920} height={1080} defaultProps={{theme: 'cream'}} />
	</>
);
