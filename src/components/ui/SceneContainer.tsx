import React from 'react';
import { cn } from '../../utils/cn';

export interface SceneContainerProps {
  children?: React.ReactNode;
  overlay?: React.ReactNode;
  className?: string;
  hasVignette?: boolean;
}

/**
 * SceneContainer provides the standard environmental background viewport.
 * In Phase 1, it renders high-fidelity 2D atmospheric SVG/CSS art.
 * In Phase 2, this container seamlessly mounts Three.js / R3F Canvas scenes.
 */
export const SceneContainer: React.FC<SceneContainerProps> = ({
  children,
  overlay,
  className,
  hasVignette = true,
}) => {
  return (
    <div className={cn('absolute inset-0 w-full h-full overflow-hidden pointer-events-auto', className)}>
      {/* Visual Scene Slot (2D Art now, 3D Canvas in Phase 2) */}
      <div className="absolute inset-0 w-full h-full z-0">{children}</div>

      {/* Cinematic Vignette & Lighting Overlay */}
      {hasVignette && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,4,8,0.7)_90%,rgba(2,4,8,0.95)_100%)] z-1" />
      )}

      {/* Contextual UI Overlay */}
      {overlay && <div className="relative z-10 w-full h-full pointer-events-none">{overlay}</div>}
    </div>
  );
};

