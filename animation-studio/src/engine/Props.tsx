import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {PropName} from './types';

const Std: React.FC<{color: string; metal?: number; rough?: number; emissive?: string}> = ({
	color,
	metal = 0.1,
	rough = 0.5,
	emissive,
}) => <meshStandardMaterial color={color} metalness={metal} roughness={rough} emissive={emissive ?? '#000000'} />;

export const Coin: React.FC<{position?: [number, number, number]; spin?: number; scale?: number}> = ({
	position = [0, 0, 0],
	spin = 0,
	scale = 1,
}) => (
	<group position={position} rotation={[Math.PI / 2, 0, spin]} scale={scale}>
		<mesh castShadow>
			<cylinderGeometry args={[0.22, 0.22, 0.05, 32]} />
			<Std color="#f5b301" metal={0.6} rough={0.3} />
		</mesh>
		<mesh position={[0, 0.03, 0]}>
			<cylinderGeometry args={[0.16, 0.16, 0.012, 32]} />
			<Std color="#ffd24a" metal={0.6} rough={0.25} />
		</mesh>
	</group>
);

export const Bill: React.FC<{position?: [number, number, number]; rotation?: [number, number, number]; scale?: number}> = ({
	position = [0, 0, 0],
	rotation = [0, 0, 0],
	scale = 1,
}) => (
	<group position={position} rotation={rotation} scale={scale}>
		<mesh castShadow>
			<boxGeometry args={[0.6, 0.012, 0.28]} />
			<Std color="#5fbf6a" />
		</mesh>
		<mesh position={[0, 0.008, 0]}>
			<cylinderGeometry args={[0.07, 0.07, 0.004, 20]} />
			<Std color="#2f8a3c" />
		</mesh>
	</group>
);

export const CashStack: React.FC<{position?: [number, number, number]; count?: number}> = ({position = [0, 0, 0], count = 6}) => (
	<group position={position}>
		{Array.from({length: count}).map((_, i) => (
			<Bill key={i} position={[Math.sin(i * 2.1) * 0.02, i * 0.03, Math.cos(i * 1.7) * 0.02]} rotation={[0, i * 0.05, 0]} />
		))}
	</group>
);

export const MoneyBag: React.FC<{position?: [number, number, number]; scale?: number}> = ({position = [0, 0, 0], scale = 1}) => (
	<group position={position} scale={scale}>
		<mesh castShadow position={[0, 0.3, 0]} scale={[1, 0.9, 1]}>
			<sphereGeometry args={[0.32, 32, 24]} />
			<Std color="#c9a36b" rough={0.8} />
		</mesh>
		<mesh castShadow position={[0, 0.62, 0]}>
			<cylinderGeometry args={[0.07, 0.14, 0.14, 16]} />
			<Std color="#b88e55" rough={0.8} />
		</mesh>
		<mesh position={[0, 0.3, 0.3]}>
			<boxGeometry args={[0.05, 0.22, 0.02]} />
			<Std color="#2f8a3c" />
		</mesh>
		<mesh position={[0, 0.3, 0.3]}>
			<torusGeometry args={[0.07, 0.02, 8, 20, Math.PI * 1.5]} />
			<Std color="#2f8a3c" />
		</mesh>
	</group>
);

export const House: React.FC<{position?: [number, number, number]; scale?: number}> = ({position = [0, 0, 0], scale = 1}) => (
	<group position={position} scale={scale}>
		<mesh castShadow position={[0, 0.3, 0]}>
			<boxGeometry args={[0.7, 0.6, 0.6]} />
			<Std color="#ffffff" />
		</mesh>
		<mesh castShadow position={[0, 0.78, 0]} rotation={[0, Math.PI / 4, 0]}>
			<coneGeometry args={[0.62, 0.4, 4]} />
			<Std color="#e5484d" />
		</mesh>
		<mesh position={[0, 0.17, 0.305]}>
			<boxGeometry args={[0.16, 0.34, 0.01]} />
			<Std color="#7a4b2a" />
		</mesh>
	</group>
);

const heartShape = () => {
	const s = new THREE.Shape();
	s.moveTo(0, -0.3);
	s.bezierCurveTo(-0.45, 0, -0.3, 0.35, 0, 0.15);
	s.bezierCurveTo(0.3, 0.35, 0.45, 0, 0, -0.3);
	return s;
};

export const Heart: React.FC<{position?: [number, number, number]; scale?: number}> = ({position = [0, 0, 0], scale = 1}) => {
	const geom = useMemo(
		() => new THREE.ExtrudeGeometry(heartShape(), {depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 4}),
		[],
	);
	return (
		<mesh geometry={geom} position={position} scale={scale} castShadow>
			<Std color="#ff4d6d" rough={0.35} />
		</mesh>
	);
};

export const Lightbulb: React.FC<{position?: [number, number, number]; scale?: number}> = ({position = [0, 0, 0], scale = 1}) => (
	<group position={position} scale={scale}>
		<mesh>
			<sphereGeometry args={[0.2, 24, 24]} />
			<Std color="#fff3a3" emissive="#ffd23f" />
		</mesh>
		<mesh position={[0, -0.24, 0]}>
			<cylinderGeometry args={[0.09, 0.09, 0.12, 16]} />
			<Std color="#9aa0a6" metal={0.7} />
		</mesh>
	</group>
);

export const QuestionMark: React.FC<{position?: [number, number, number]; scale?: number}> = ({position = [0, 0, 0], scale = 1}) => (
	<group position={position} scale={scale}>
		<mesh position={[0, 0.12, 0]} rotation={[0, 0, -Math.PI / 4]}>
			<torusGeometry args={[0.14, 0.045, 12, 24, Math.PI * 1.4]} />
			<Std color="#ffb703" />
		</mesh>
		<mesh position={[0.0, -0.08, 0]}>
			<cylinderGeometry args={[0.045, 0.045, 0.12, 12]} />
			<Std color="#ffb703" />
		</mesh>
		<mesh position={[0, -0.25, 0]}>
			<sphereGeometry args={[0.05, 16, 16]} />
			<Std color="#ffb703" />
		</mesh>
	</group>
);

/** A prop that floats beside a character's head and bobs gently. */
export const FloatingProp: React.FC<{name: PropName; position?: [number, number, number]}> = ({name, position = [0.55, 2.55, 0]}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = frame / fps;
	const pop = Math.min(1, frame / 8);
	const y = position[1] + Math.sin(t * 2.5) * 0.06;
	const p: [number, number, number] = [position[0], y, position[2]];
	const s = pop;
	switch (name) {
		case 'coin':
			return <Coin position={p} spin={t * 3} scale={s * 1.3} />;
		case 'cash':
			return <CashStack position={[p[0], p[1] - 0.2, p[2]]} />;
		case 'moneyBag':
			return <MoneyBag position={[p[0], p[1] - 0.4, p[2]]} scale={s} />;
		case 'house':
			return <House position={[p[0], p[1] - 0.4, p[2]]} scale={s * 0.8} />;
		case 'heart':
			return <Heart position={p} scale={s * (1 + Math.sin(t * 6) * 0.05)} />;
		case 'lightbulb':
			return <Lightbulb position={p} scale={s} />;
		case 'question':
		default:
			return <QuestionMark position={p} scale={s} />;
	}
};
