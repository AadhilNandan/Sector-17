import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface AmbientStarfieldProps {
  count?: number;
  gridSize?: number;
}

export function AmbientStarfield({ count = 800, gridSize = 40 }: AmbientStarfieldProps) {
  const pointsRef = useRef<THREE.Points>(null!);

  // Generate lightweight random star positions in 2.5D space
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const cyanColor = new THREE.Color('#00f0ff');
    const amberColor = new THREE.Color('#f59e0b');
    const dimColor = new THREE.Color('#64748b');

    for (let i = 0; i < count; i++) {
      // 2.5D planar distribution: wide X and Y, shallow Z
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15 - 5;

      // Color variation: mostly subtle graphite/dim, occasional cyan/amber beacon
      const rand = Math.random();
      let chosenColor = dimColor;
      if (rand > 0.92) {
        chosenColor = cyanColor;
      } else if (rand > 0.85) {
        chosenColor = amberColor;
      }

      col[i * 3] = chosenColor.r;
      col[i * 3 + 1] = chosenColor.g;
      col[i * 3 + 2] = chosenColor.b;
    }

    return [pos, col];
  }, [count]);

  // Very subtle idle drift for ambient cinematic feel
  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.z += delta * 0.005;
    }
  });

  return (
    <group>
      {/* 2.5D Tactical coordinate grid plane */}
      <gridHelper
        args={[gridSize, 20, '#00f0ff', '#1e2637']}
        position={[0, 0, -2]}
        rotation={[Math.PI / 2.3, 0, 0]}
      />

      {/* Ambient starfield points */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.12}
          vertexColors
          transparent
          opacity={0.75}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

