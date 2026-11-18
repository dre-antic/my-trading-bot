import React from 'react';
import {Video} from './engine/Video';
import {projects} from './projects';

// Compositions receive only the id: Remotion serializes props to JSON, which would drop
// functions such as a storyboard's customScenes.
export const ProjectVideo: React.FC<{storyboardId: string}> = ({storyboardId}) => {
	const storyboard = projects.find((p) => p.id === storyboardId);
	if (!storyboard) throw new Error(`No storyboard with id "${storyboardId}" in src/projects/index.ts`);
	return <Video storyboard={storyboard} />;
};
