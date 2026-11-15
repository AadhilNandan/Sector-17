import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createStarfieldMesh } from './StarfieldMesh';
import { createJupiterMesh } from './JupiterMesh';
import { createAethonCraftMesh } from './AethonCraftMesh';
import { MainMenuSceneFallback } from './MainMenuSceneFallback';

/**
 * Checks whether WebGL is supported in the current browser/runtime.
 */
export function isWebGLAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export const MainMenu3DScene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  useEffect(() => {
    if (!isWebGLAvailable()) {
      setWebglSupported(false);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040609);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 32);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
    } catch {
      setWebglSupported(false);
      return;
    }

    // 2. Lighting System matching reference image (Sun from top-left)
    const ambientLight = new THREE.AmbientLight(0x0a0e17, 0.25);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ee, 2.85);
    sunLight.position.set(-28, 22, 24);
    scene.add(sunLight);

    // Subtle Jovian albedo bounce light onto spacecraft
    const jupiterBounceLight = new THREE.PointLight(0xd9ba9a, 0.65, 30);
    jupiterBounceLight.position.set(12, 6, 8);
    scene.add(jupiterBounceLight);

    // 3. Deep Space Starfield
    const starfield = createStarfieldMesh(1800, 220);
    scene.add(starfield);

    // 4. Jupiter System (Upper-right quadrant, massive scale)
    const jupiterBundle = createJupiterMesh(18.5);
    // Position upper-right so it occupies ~45-50% of screen with curved dark terminator
    jupiterBundle.group.position.set(17.5, 11.2, -6.5);
    scene.add(jupiterBundle.group);

    // 5. AETHON Spacecraft (Positioned beneath Jupiter, slightly right of center)
    const aethonBundle = createAethonCraftMesh();
    aethonBundle.group.position.set(3.8, -4.6, 7.5);
    aethonBundle.group.scale.setScalar(0.72);
    scene.add(aethonBundle.group);

    // 6. Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    let elapsed = 0;

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      elapsed += delta;

      // Update planetary rotation & atmospheric scattering
      jupiterBundle.update(delta);

      // Update spacecraft attitude drift and thruster shimmer
      aethonBundle.update(elapsed, delta);

      // Very subtle celestial star drift
      starfield.rotation.y = elapsed * 0.0004;

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 7. Responsive Viewport Handler
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;

      // Dynamically tune Jupiter and craft framing based on aspect ratio
      if (width / height < 1.3) {
        // Narrow or vertical screen
        jupiterBundle.group.position.set(11.5, 12.5, -6.5);
        aethonBundle.group.position.set(1.5, -4.2, 7.5);
      } else {
        // Standard widescreen
        jupiterBundle.group.position.set(17.5, 11.2, -6.5);
        aethonBundle.group.position.set(3.8, -4.6, 7.5);
      }

      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // 8. Cleanup & Resource Disposal
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);

      jupiterBundle.dispose();
      aethonBundle.dispose();

      starfield.geometry.dispose();
      (starfield.material as THREE.Material).dispose();

      renderer.dispose();
    };
  }, []);

  if (!webglSupported) {
    return <MainMenuSceneFallback />;
  }

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#040609]" data-testid="main-menu-3d-scene">
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />
    </div>
  );
};
