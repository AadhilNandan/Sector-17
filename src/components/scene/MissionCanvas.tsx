import React from 'react';
import { Canvas } from '@react-three/fiber';
import { cn } from '../../utils/cn';
import { AmbientStarfield } from './AmbientStarfield';

export interface MissionCanvasProps {
  children?: React.ReactNode;
  className?: string;
  showStarfield?: boolean;
}

export const MissionCanvas: React.FC<MissionCanvasProps> = ({
  children,
  className,
  showStarfield = true,
}) => {
  return (
    <div className={cn('absolute inset-0 w-full h-full pointer-events-auto', className)}>
      <Canvas
        camera={{ position: [0, 0, 18], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor('#05070a', 1);
          scene.fog = null;
        }}
      >
        <ambientLight intensity={0.4} />
        {showStarfield && <AmbientStarfield />}
        {children}
      </Canvas>
    </div>
  );
};

