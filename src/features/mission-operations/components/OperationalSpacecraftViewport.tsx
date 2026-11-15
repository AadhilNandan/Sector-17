import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { createAethonEngineeringModel } from '../../spacecraft-workshop/components/AethonEngineeringMesh';
import { sounds } from '../../../utils/soundEffects';

export interface OperationalSpacecraftViewportProps {
  flightState?: string;
  isEngineFiring?: boolean;
}

/**
 * Creates a procedural Europa moon texture with icy tectonic ridges and bands.
 */
function createEuropaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Pale ice base
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#EAE6DF');
    grad.addColorStop(0.5, '#F5F2EC');
    grad.addColorStop(1, '#D9D3C7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Chaos terrain mottling
    ctx.fillStyle = '#C8B9A6';
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * 1024;
      const ry = Math.random() * 512;
      const r = Math.random() * 22 + 4;
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cycloidal lineae (reddish-brown fractures)
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#8A5D3B';
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      let x = Math.random() * 1024;
      let y = Math.random() * 512;
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (Math.random() - 0.5) * 140;
        y += (Math.random() - 0.5) * 70;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export const OperationalSpacecraftViewport: React.FC<OperationalSpacecraftViewportProps> = ({
  flightState: _flightState = 'ACTIVE',
  isEngineFiring = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [webglSupported, setWebglSupported] = useState(true);
  const [followMode, setFollowMode] = useState(false);

  // Camera spherical coordinates
  const cameraState = useRef({
    targetRadius: 18.0,
    currentRadius: 18.0,
    targetTheta: 0.95, // Azimuth around Y
    currentTheta: 0.95,
    targetPhi: 0.42, // Elevation angle
    currentPhi: 0.42,
    isDragging: false,
    prevPointerX: 0,
    prevPointerY: 0,
    center: new THREE.Vector3(0, 0, 0),
  });

  const resetCamera = useCallback(() => {
    sounds.playClick(1000);
    cameraState.current.targetRadius = 18.0;
    cameraState.current.targetTheta = 0.95;
    cameraState.current.targetPhi = 0.42;
    cameraState.current.center.set(0, 0, 0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x040609, 1);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    } catch {
      setWebglSupported(false);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);

    // 1. Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 400;
      starPos[i + 1] = (Math.random() - 0.5) * 400;
      starPos[i + 2] = (Math.random() - 0.5) * 400;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xddeeff,
      size: 1.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // 2. Europa Moon Sphere in Background (upper left as in screenshot)
    const europaTex = createEuropaTexture();
    const europaGeo = new THREE.SphereGeometry(3.6, 64, 64);
    const europaMat = new THREE.MeshStandardMaterial({
      map: europaTex,
      roughness: 0.75,
      metalness: 0.1,
    });
    const europaMesh = new THREE.Mesh(europaGeo, europaMat);
    europaMesh.position.set(-14, 8, -18);
    europaMesh.rotation.y = -0.4;
    scene.add(europaMesh);

    // 3. Orbital Trajectory Ellipse passing through space
    const curvePoints: THREE.Vector3[] = [];
    const ellipseRadiusX = 26;
    const ellipseRadiusZ = 16;
    for (let i = 0; i <= 100; i++) {
      const angle = (i / 100) * Math.PI * 2;
      const x = Math.cos(angle) * ellipseRadiusX - 4;
      const z = Math.sin(angle) * ellipseRadiusZ - 6;
      const y = Math.sin(angle * 2) * 2.5 + 1.5;
      curvePoints.push(new THREE.Vector3(x, y, z));
    }
    const trajGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const trajMat = new THREE.LineBasicMaterial({
      color: 0x35c6f4,
      transparent: true,
      opacity: 0.45,
    });
    const trajLine = new THREE.Line(trajGeo, trajMat);
    scene.add(trajLine);

    // 4. Lighting
    // Strong key sunlight from upper-right
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.8);
    sunLight.position.set(22, 16, 14);
    scene.add(sunLight);

    // Subtle ambient light
    const ambientLight = new THREE.AmbientLight(0x162030, 0.6);
    scene.add(ambientLight);

    // Secondary fill light from Europa/Jovian bounce
    const fillLight = new THREE.DirectionalLight(0x89b6e8, 0.45);
    fillLight.position.set(-14, 8, -10);
    scene.add(fillLight);

    // 5. AETHON Spacecraft
    const aethon = createAethonEngineeringModel();
    // Default orientation: elongated along diagonal matching reference screenshot
    aethon.rootGroup.position.set(0, 0, 0);
    aethon.rootGroup.rotation.set(-0.15, -0.75, 0.2);
    scene.add(aethon.rootGroup);

    // Thruster exhaust flame (visible if firing)
    const exhaustGeo = new THREE.ConeGeometry(0.28, 1.4, 16);
    exhaustGeo.rotateZ(Math.PI / 2);
    exhaustGeo.translate(-1.9, 0, 0);
    const exhaustMat = new THREE.MeshBasicMaterial({
      color: 0x35c6f4,
      transparent: true,
      opacity: 0.85,
    });
    const exhaustMesh = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaustMesh.visible = isEngineFiring;
    aethon.rootGroup.add(exhaustMesh);

    // Handle Resize
    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth camera damping
      const state = cameraState.current;
      state.currentRadius += (state.targetRadius - state.currentRadius) * 0.08;
      state.currentTheta += (state.targetTheta - state.currentTheta) * 0.08;
      state.currentPhi += (state.targetPhi - state.currentPhi) * 0.08;

      // Spherical to Cartesian
      const r = state.currentRadius;
      const phi = state.currentPhi;
      const theta = state.currentTheta;

      const camX = r * Math.cos(phi) * Math.sin(theta);
      const camY = r * Math.sin(phi);
      const camZ = r * Math.cos(phi) * Math.cos(theta);

      camera.position.set(camX + state.center.x, camY + state.center.y, camZ + state.center.z);
      camera.lookAt(state.center);

      // Subtle celestial rotation
      europaMesh.rotation.y += delta * 0.01;

      // Subtle spacecraft attitude stabilization drift
      aethon.rootGroup.rotation.z += Math.sin(elapsed * 0.2) * 0.0001;

      // Update engine firing plume
      exhaustMesh.visible = isEngineFiring;
      if (isEngineFiring) {
        exhaustMesh.scale.set(1 + Math.sin(elapsed * 30) * 0.1, 1, 1);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      aethon.dispose();
      starGeo.dispose();
      starMat.dispose();
      europaGeo.dispose();
      europaMat.dispose();
      europaTex.dispose();
      trajGeo.dispose();
      trajMat.dispose();
      exhaustGeo.dispose();
      exhaustMat.dispose();
      renderer.dispose();
    };
  }, [isEngineFiring]);

  // Pointer Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    cameraState.current.isDragging = true;
    cameraState.current.prevPointerX = e.clientX;
    cameraState.current.prevPointerY = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!cameraState.current.isDragging) return;
    const dx = e.clientX - cameraState.current.prevPointerX;
    const dy = e.clientY - cameraState.current.prevPointerY;
    cameraState.current.prevPointerX = e.clientX;
    cameraState.current.prevPointerY = e.clientY;

    cameraState.current.targetTheta -= dx * 0.006;
    cameraState.current.targetPhi = Math.max(
      -0.4,
      Math.min(1.2, cameraState.current.targetPhi + dy * 0.006)
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    cameraState.current.isDragging = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY * 0.015;
    cameraState.current.targetRadius = Math.max(
      10.0,
      Math.min(36.0, cameraState.current.targetRadius + zoomFactor)
    );
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      className="relative w-full h-full bg-[#040609] overflow-hidden select-none cursor-grab active:cursor-grabbing"
      aria-label="3D Operational Spacecraft Viewport"
    >
      {/* Three.js Canvas */}
      {webglSupported ? (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[#A5B1C2] font-mono text-xs">
          [3D VIEWPORT: WEBGL CONTEXT NOT AVAILABLE]
        </div>
      )}

      {/* Sun Lens Flare Bloom (Upper Right as in screenshot) */}
      <div className="absolute top-2 right-4 w-48 h-48 rounded-full bg-gradient-to-br from-white/30 via-[#FFEEC2]/10 to-transparent blur-3xl pointer-events-none" />

      {/* ======================================================== */}
      {/* HUD OVERLAYS (STRICT pointer-events-none)                 */}
      {/* ======================================================== */}

      {/* Top-Left: Camera ID */}
      <div className="absolute top-3 left-4 font-mono text-[11px] text-[#A5B1C2] tracking-wider pointer-events-none select-none">
        CAM_EXT_A_04 // RESOLUTION: HI-RES
      </div>

      {/* Bottom-Left: Camera ID */}
      <div className="absolute bottom-3 left-4 font-mono text-[11px] text-[#A5B1C2] tracking-wider pointer-events-none select-none">
        CAM_EXT_A_04 // RESOLUTION: HI-RES
      </div>

      {/* Center Reticle Crosshairs */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-20 h-20 opacity-30">
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[#35C6F4]" />
          <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-[#35C6F4]" />
          <div className="absolute inset-4 border border-[#35C6F4] rounded-[1px]" />
        </div>
      </div>

      {/* Center Targeting Bracket around AETHON */}
      <div className="absolute top-[44%] left-[46%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="relative w-28 h-20 border border-white/20 border-dashed rounded-sm">
          {/* Corner tick marks */}
          <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-[#35C6F4]" />
          <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-[#35C6F4]" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-[#35C6F4]" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-[#35C6F4]" />
        </div>
        {/* Right Label */}
        <div className="absolute top-full right-0 mt-1 font-mono text-[10px] text-[#31C48D] tracking-wider">
          <span className="text-[#A5B1C2] block text-[9px]">ATTITUDE:</span>
          <span>[ NOMINAL ]</span>
        </div>
      </div>

      {/* Bottom-Right: Attitude Readout */}
      <div className="absolute bottom-3 right-4 font-mono text-[11px] text-[#31C48D] tracking-wider pointer-events-none select-none">
        <span className="text-[#A5B1C2]">ATTITUDE: </span>
        <span>[ NOMINAL ]</span>
      </div>

      {/* Viewport Control Buttons (Pointer-events auto) */}
      <div className="absolute top-3 right-4 flex items-center gap-2 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={resetCamera}
          className="px-2 py-1 rounded bg-[#080D16]/80 hover:bg-[#080D16] border border-white/15 text-[#A5B1C2] hover:text-white font-mono text-[10px] tracking-wider uppercase transition-all cursor-pointer shadow-md"
          title="Reset Camera to Default Isometric View"
        >
          RESET CAM
        </button>

        <button
          type="button"
          onClick={() => {
            sounds.playClick(1100);
            setFollowMode((prev) => !prev);
          }}
          className={`px-2 py-1 rounded border font-mono text-[10px] tracking-wider uppercase transition-all cursor-pointer shadow-md ${
            followMode
              ? 'bg-[#35C6F4]/20 border-[#35C6F4]/40 text-[#35C6F4]'
              : 'bg-[#080D16]/80 border-white/15 text-[#A5B1C2] hover:text-white'
          }`}
          title="Toggle Spacecraft Tracking Mode"
        >
          {followMode ? 'FOLLOW: ON' : 'FOLLOW: OFF'}
        </button>
      </div>
    </div>
  );
};
