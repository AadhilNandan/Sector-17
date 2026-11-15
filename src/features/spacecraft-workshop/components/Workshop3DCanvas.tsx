import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { createAethonEngineeringModel, type AethonModelBundle } from './AethonEngineeringMesh';
import type { ComponentCategory, SpacecraftConfig } from '../../../types/game';
import { Plus, Minus, RotateCcw } from 'lucide-react';

export type WorkshopCameraPreset = '3/4' | 'front' | 'side' | 'rear';

export interface Workshop3DCanvasProps {
  spacecraft: SpacecraftConfig;
  selectedCategory: ComponentCategory;
  cameraPreset: WorkshopCameraPreset;
  onCameraPresetChange?: (preset: WorkshopCameraPreset) => void;
  activePartName?: string;
}

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

export const Workshop3DCanvas: React.FC<Workshop3DCanvasProps> = ({
  selectedCategory,
  cameraPreset,
  activePartName: _activePartName,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  // Model and camera refs for interactive controls
  const bundleRef = useRef<AethonModelBundle | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsStateRef = useRef<{
    isDragging: boolean;
    previousMouseX: number;
    previousMouseY: number;
    rotationX: number;
    rotationY: number;
    zoom: number;
    targetZoom: number;
    userInteracting: boolean;
    lastInteractionTime: number;
  }>({
    isDragging: false,
    previousMouseX: 0,
    previousMouseY: 0,
    rotationX: 0.35,
    rotationY: -0.65,
    zoom: 9.5,
    targetZoom: 9.5,
    userInteracting: false,
    lastInteractionTime: Date.now(),
  });

  // Camera preset position mappings
  const applyPreset = useCallback((preset: WorkshopCameraPreset) => {
    const state = controlsStateRef.current;
    state.lastInteractionTime = Date.now();

    switch (preset) {
      case 'front':
        state.rotationX = 0;
        state.rotationY = Math.PI / 2;
        state.targetZoom = 9.0;
        break;
      case 'side':
        state.rotationX = 0;
        state.rotationY = 0;
        state.targetZoom = 9.5;
        break;
      case 'rear':
        state.rotationX = 0;
        state.rotationY = -Math.PI / 2;
        state.targetZoom = 9.0;
        break;
      case '3/4':
      default:
        state.rotationX = 0.35;
        state.rotationY = -0.65;
        state.targetZoom = 9.5;
        break;
    }
  }, []);

  // Update highlight when selected category changes
  useEffect(() => {
    if (bundleRef.current) {
      bundleRef.current.updateHighlight(selectedCategory);
    }
  }, [selectedCategory]);

  // Update preset when prop changes
  useEffect(() => {
    applyPreset(cameraPreset);
  }, [cameraPreset, applyPreset]);

  // Main Three.js Lifecycle
  useEffect(() => {
    if (!isWebGLAvailable()) {
      setWebglSupported(false);
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090c);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
    } catch {
      setWebglSupported(false);
      return;
    }

    // 2. Lighting System (Engineering Cleanroom / Gantry Downlights)
    const ambientLight = new THREE.AmbientLight(0x232d3b, 1.4);
    scene.add(ambientLight);

    // Primary overhead spotlight
    const overheadLight = new THREE.DirectionalLight(0xfff5ea, 2.5);
    overheadLight.position.set(6, 12, 8);
    scene.add(overheadLight);

    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0x7fb7d4, 1.2);
    fillLight.position.set(-8, 6, -6);
    scene.add(fillLight);

    // Ventral bounce light
    const floorBounce = new THREE.PointLight(0x3a4b61, 1.1, 20);
    floorBounce.position.set(0, -4, 0);
    scene.add(floorBounce);

    // 3. Technical Floor Drafting Grid
    const floorGrid = new THREE.GridHelper(26, 26, 0x7fb7d4, 0x1a232f);
    floorGrid.position.y = -1.8;
    (floorGrid.material as THREE.LineBasicMaterial).transparent = true;
    (floorGrid.material as THREE.LineBasicMaterial).opacity = 0.55;
    scene.add(floorGrid);

    // 4. AETHON Spacecraft Engineering Model
    const modelBundle = createAethonEngineeringModel();
    bundleRef.current = modelBundle;
    scene.add(modelBundle.rootGroup);

    // 5. Interactive Animation & Camera Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    let elapsed = 0;

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      elapsed += delta;

      const state = controlsStateRef.current;

      // Smooth zoom interpolation
      state.zoom += (state.targetZoom - state.zoom) * 0.1;

      // Gentle auto-rotation when user is idle for > 4 seconds
      if (Date.now() - state.lastInteractionTime > 4000 && !state.isDragging) {
        state.rotationY += delta * 0.08;
      }

      // Calculate camera position from spherical orbit
      const cosX = Math.cos(state.rotationX);
      const sinX = Math.sin(state.rotationX);
      const cosY = Math.cos(state.rotationY);
      const sinY = Math.sin(state.rotationY);

      camera.position.x = state.zoom * cosX * sinY;
      camera.position.y = state.zoom * sinX;
      camera.position.z = state.zoom * cosX * cosY;
      camera.lookAt(0, 0, 0);

      // Update model dynamic elements
      modelBundle.update(elapsed);

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 6. Viewport Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // 7. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      modelBundle.dispose();
      floorGrid.geometry.dispose();
      (floorGrid.material as THREE.Material).dispose();
      renderer.dispose();
      bundleRef.current = null;
    };
  }, []);

  // Global Mouse & Pointer Listeners to guarantee uninterrupted drag & zoom
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const state = controlsStateRef.current;
      if (!state.isDragging) return;

      const deltaX = e.clientX - state.previousMouseX;
      const deltaY = e.clientY - state.previousMouseY;

      state.rotationY += deltaX * 0.007;
      state.rotationX = Math.max(-1.1, Math.min(1.1, state.rotationX + deltaY * 0.007));

      state.previousMouseX = e.clientX;
      state.previousMouseY = e.clientY;
      state.lastInteractionTime = Date.now();
    };

    const handleGlobalMouseUp = () => {
      controlsStateRef.current.isDragging = false;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Non-passive wheel event listener on container to smoothly zoom without page scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = controlsStateRef.current;
      const zoomDelta = e.deltaY * 0.005;
      state.targetZoom = Math.max(5.5, Math.min(16.0, state.targetZoom + zoomDelta));
      state.lastInteractionTime = Date.now();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const state = controlsStateRef.current;
    state.isDragging = true;
    state.previousMouseX = e.clientX;
    state.previousMouseY = e.clientY;
    state.lastInteractionTime = Date.now();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const state = controlsStateRef.current;
    if (!state.isDragging) return;

    const deltaX = e.clientX - state.previousMouseX;
    const deltaY = e.clientY - state.previousMouseY;

    state.rotationY += deltaX * 0.007;
    state.rotationX = Math.max(-1.1, Math.min(1.1, state.rotationX + deltaY * 0.007));

    state.previousMouseX = e.clientX;
    state.previousMouseY = e.clientY;
    state.lastInteractionTime = Date.now();
  };

  const handleMouseUp = () => {
    controlsStateRef.current.isDragging = false;
  };

  // Zoom Button Handlers
  const handleZoomIn = () => {
    const state = controlsStateRef.current;
    state.targetZoom = Math.max(5.5, state.targetZoom - 1.5);
    state.lastInteractionTime = Date.now();
  };

  const handleZoomOut = () => {
    const state = controlsStateRef.current;
    state.targetZoom = Math.min(16.0, state.targetZoom + 1.5);
    state.lastInteractionTime = Date.now();
  };

  const handleResetCamera = () => {
    applyPreset('3/4');
  };

  if (!webglSupported) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center bg-[#07090C] text-[#A9B0B5] p-6 select-none"
        data-testid="workshop-webgl-fallback"
      >
        <div className="w-16 h-16 rounded border border-[#7FB7D4] flex items-center justify-center text-[#7FB7D4] mb-3">
          <RotateCcw size={28} />
        </div>
        <h3 className="font-display text-lg font-bold uppercase text-[#E6E2D6] tracking-wider">
          AETHON Technical Drafting Schematics
        </h3>
        <p className="font-mono text-xs max-w-sm text-center text-[#6B757D] mt-1">
          WebGL rendering unavailable in current environment. Authoritative simulation metrics and component
          selection remain fully active.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#07090C] cursor-grab active:cursor-grabbing select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      data-testid="workshop-3d-canvas"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Top Watermark: DRAG TO ROTATE */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none font-mono text-[10px] tracking-[0.2em] text-[#6B757D]/70 uppercase">
        DRAG TO ROTATE ↻
      </div>

      {/* Bottom Center Watermark: DRAG TO ROTATE */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none font-mono text-[10px] tracking-[0.2em] text-[#6B757D]/70 uppercase">
        DRAG TO ROTATE ↻
      </div>

      {/* Bottom-Right Zoom & Reset Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In"
          className="w-8 h-8 rounded-xs bg-[#151B22]/90 border border-[#2B3642] hover:border-[#7FB7D4] text-[#A9B0B5] hover:text-[#FFFFFF] flex items-center justify-center transition-colors cursor-pointer"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out"
          className="w-8 h-8 rounded-xs bg-[#151B22]/90 border border-[#2B3642] hover:border-[#7FB7D4] text-[#A9B0B5] hover:text-[#FFFFFF] flex items-center justify-center transition-colors cursor-pointer"
        >
          <Minus size={15} />
        </button>
        <button
          type="button"
          onClick={handleResetCamera}
          title="Reset Camera"
          className="w-8 h-8 rounded-xs bg-[#151B22]/90 border border-[#2B3642] hover:border-[#7FB7D4] text-[#A9B0B5] hover:text-[#FFFFFF] flex items-center justify-center transition-colors cursor-pointer"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
};
