import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GimbalCompass } from './GimbalCompass';
import type { TrajectoryScaleMode } from './TrajectoryHeader';
import { RotateCcw } from 'lucide-react';

export interface OrbitalViewport3DProps {
  scaleMode: TrajectoryScaleMode;
  isSimulating?: boolean;
  selectedManeuverId?: string;
  onSelectManeuverNode?: (id: string) => void;
  isCommWindowActive?: boolean;
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

/**
 * Creates a procedural multi-band atmospheric texture for Jupiter with the Great Red Spot.
 */
function createJupiterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#75543A'); // North Polar Hood
    grad.addColorStop(0.18, '#C49E74');
    grad.addColorStop(0.32, '#8E5A36'); // North Equatorial Belt
    grad.addColorStop(0.48, '#E6DAC4'); // Equatorial Zone
    grad.addColorStop(0.55, '#995E39'); // South Equatorial Belt
    grad.addColorStop(0.72, '#D2B48C'); // South Tropical Zone
    grad.addColorStop(0.85, '#B28258');
    grad.addColorStop(1.0, '#5D402B'); // South Polar Hood
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    for (let y = 10; y < 510; y += 4) {
      const alpha = 0.08 + Math.sin(y * 0.15) * 0.06;
      ctx.fillStyle = y % 8 === 0 ? `rgba(60, 30, 10, ${alpha})` : `rgba(255, 240, 210, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < 1024; x += 16) {
        const wave = Math.sin(x * 0.04 + y * 0.08) * 2.5;
        ctx.lineTo(x, y + wave);
      }
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Great Red Spot storm vortex in South Tropical Zone
    ctx.save();
    ctx.translate(640, 310);
    ctx.scale(1.8, 1.0);
    const grsGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 42);
    grsGrad.addColorStop(0, '#B33E24');
    grsGrad.addColorStop(0.6, '#C95B38');
    grsGrad.addColorStop(1, 'rgba(180, 110, 70, 0)');
    ctx.fillStyle = grsGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * Creates a procedural fractured ice texture for Europa with lineae fractures and chaotic terrain.
 */
function createEuropaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#E3E7EB';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 400; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 2 + Math.random() * 8;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(180, 195, 205, 0.2)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#8E5A38';
    ctx.lineWidth = 2.5;
    const lines = [
      [[40, 80], [140, 210], [280, 320], [420, 380]],
      [[110, 420], [240, 310], [360, 210], [480, 140]],
      [[80, 260], [220, 240], [380, 290], [490, 330]],
      [[260, 40], [280, 180], [310, 360], [330, 490]],
      [[180, 80], [210, 200], [240, 380], [270, 470]],
    ];

    lines.forEach((pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(165, 105, 65, 0.35)';
    [
      [160, 180, 35],
      [360, 340, 45],
      [240, 410, 30],
    ].forEach(([cx, cy, rad]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  return new THREE.CanvasTexture(canvas);
}

export const OrbitalViewport3D: React.FC<OrbitalViewport3DProps> = ({
  scaleMode,
  isSimulating = true,
  selectedManeuverId: _selectedManeuverId,
  onSelectManeuverNode,
  isCommWindowActive = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  // Overlay layer state
  const [isDeltaVOn, setIsDeltaVOn] = useState(true);
  const [isCommWindowsOn, setIsCommWindowsOn] = useState(true);
  const [isRadiationOn, setIsRadiationOn] = useState(true);
  const [isFollowAethon, setIsFollowAethon] = useState(false);

  // Compass state
  const [cameraAzimuth, setCameraAzimuth] = useState(30);
  const [cameraElevation, setCameraElevation] = useState(16);

  // DOM refs for 3D world-to-screen projected badges (avoids layout thrashing)
  const badgeRefs = {
    tmi: useRef<HTMLDivElement | null>(null),
    joi: useRef<HTMLDivElement | null>(null),
    commWindow: useRef<HTMLDivElement | null>(null),
    radiation: useRef<HTMLDivElement | null>(null),
    eoc: useRef<HTMLDivElement | null>(null),
    aethon: useRef<HTMLDivElement | null>(null),
    targetEuropa: useRef<HTMLDivElement | null>(null),
    closestApproach: useRef<HTMLDivElement | null>(null),
  };

  // World anchors for projection
  const anchorsRef = useRef<{
    tmi: THREE.Vector3;
    joi: THREE.Vector3;
    commWindow: THREE.Vector3;
    radiation: THREE.Vector3;
    eoc: THREE.Vector3;
    aethon: THREE.Vector3;
    targetEuropa: THREE.Vector3;
    closestApproach: THREE.Vector3;
    opticalCentroid: THREE.Vector3;
    jupiter: THREE.Vector3;
    europa: THREE.Vector3;
  }>({
    tmi: new THREE.Vector3(-10.5, 5.2, 0.2),
    joi: new THREE.Vector3(-0.5, 3.2, -1.5),
    commWindow: new THREE.Vector3(2.3, -1.0, -0.3),
    radiation: new THREE.Vector3(5.0, 3.6, -4.0),
    eoc: new THREE.Vector3(5.5, -2.4, -0.6),
    aethon: new THREE.Vector3(-3.2, -0.4, 0.4),
    targetEuropa: new THREE.Vector3(7.8, -1.6, -1.0),
    closestApproach: new THREE.Vector3(6.8, -2.2, -0.8),
    opticalCentroid: new THREE.Vector3(1.5, 0.8, -1.5),
    jupiter: new THREE.Vector3(5.0, 3.6, -4.0),
    europa: new THREE.Vector3(7.8, -1.6, -1.0),
  });

  // Camera & Interaction controls state
  const controlsStateRef = useRef<{
    isDragging: boolean;
    previousMouseX: number;
    previousMouseY: number;
    rotationX: number;
    rotationY: number;
    zoom: number;
    targetZoom: number;
    isFollow: boolean;
    lastInteractionTime: number;
  }>({
    isDragging: false,
    previousMouseX: 0,
    previousMouseY: 0,
    rotationX: 0.28,
    rotationY: 0.52,
    zoom: 26.0,
    targetZoom: 26.0,
    isFollow: false,
    lastInteractionTime: Date.now(),
  });

  useEffect(() => {
    controlsStateRef.current.isFollow = isFollowAethon;
  }, [isFollowAethon]);

  // Main Three.js Scene Lifecycle
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
    scene.background = new THREE.Color(0x05070a);

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

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
      renderer.toneMappingExposure = 1.15;
    } catch {
      setWebglSupported(false);
      return;
    }

    // 2. Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0x222a36, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.8);
    sunLight.position.set(30, 15, 20);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x406085, 0.8);
    rimLight.position.set(-25, -10, -15);
    scene.add(rimLight);

    // 3. Deep-Space Starfield Points
    const starCount = 600;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 140;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 15;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x93a3b8,
      size: 0.8,
      transparent: true,
      opacity: 0.65,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);
    disposables.push(starGeo, starMat);

    // 4. CELESTIAL BODIES: CALIBRATED SPATIAL GEOMETRY
    const isSchematic = scaleMode === 'schematic';

    // A. JUPITER (Upper-right)
    const jupiterTex = createJupiterTexture();
    disposables.push(jupiterTex);

    const jupiterRadius = isSchematic ? 4.5 : 6.99;
    const jupiterPos = new THREE.Vector3(5.0, 3.6, -4.0);
    anchorsRef.current.jupiter = jupiterPos;
    anchorsRef.current.radiation = jupiterPos;

    const jupiterGeo = new THREE.SphereGeometry(jupiterRadius, 48, 48);
    const jupiterMat = new THREE.MeshStandardMaterial({
      map: jupiterTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const jupiterMesh = new THREE.Mesh(jupiterGeo, jupiterMat);
    jupiterMesh.position.copy(jupiterPos);
    jupiterMesh.rotation.z = 0.05;
    scene.add(jupiterMesh);
    disposables.push(jupiterGeo, jupiterMat);

    // B. EUROPA (Lower-right: separated by ~8.0 scene units, zero limb overlap)
    const europaTex = createEuropaTexture();
    disposables.push(europaTex);

    const europaRadius = isSchematic ? 1.4 : 0.156;
    const europaPos = isSchematic
      ? new THREE.Vector3(7.8, -1.6, -1.0)
      : new THREE.Vector3(18.5, -4.5, -3.0);
    anchorsRef.current.europa = europaPos;
    anchorsRef.current.targetEuropa = europaPos;

    const europaGeo = new THREE.SphereGeometry(europaRadius, 36, 36);
    const europaMat = new THREE.MeshStandardMaterial({
      map: europaTex,
      roughness: 0.45,
      metalness: 0.1,
    });
    const europaMesh = new THREE.Mesh(europaGeo, europaMat);
    europaMesh.position.copy(europaPos);
    scene.add(europaMesh);
    disposables.push(europaGeo, europaMat);

    // Optical Target Ring for Europa in True Scale mode
    let europaHaloGroup: THREE.Group | null = null;
    if (!isSchematic) {
      europaHaloGroup = new THREE.Group();
      europaHaloGroup.position.copy(europaPos);
      const haloGeo = new THREE.RingGeometry(0.4, 0.45, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x7fb7d4,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      europaHaloGroup.add(haloMesh);
      scene.add(europaHaloGroup);
      disposables.push(haloGeo, haloMat);
    }

    // C. RADIATION EXPOSURE RINGS
    const radiationGroup = new THREE.Group();
    scene.add(radiationGroup);

    [
      { bodyPos: jupiterMesh.position, r: jupiterRadius * 1.35 },
      { bodyPos: jupiterMesh.position, r: jupiterRadius * 1.70 },
      { bodyPos: jupiterMesh.position, r: jupiterRadius * 2.10 },
      { bodyPos: europaMesh.position, r: europaRadius * 1.6 },
    ].forEach(({ bodyPos, r }) => {
      const ringGeo = new THREE.RingGeometry(r - 0.04, r + 0.04, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xdf8435,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(bodyPos);
      ringMesh.rotation.x = Math.PI / 2.3;
      radiationGroup.add(ringMesh);
      disposables.push(ringGeo, ringMat);
    });

    // D. COMMUNICATION WINDOW FAN BEAM
    const commFanGroup = new THREE.Group();
    scene.add(commFanGroup);

    const aethonPos = anchorsRef.current.aethon;
    const commTarget = europaMesh.position;
    const fanLines = 8;
    for (let i = 0; i < fanLines; i++) {
      const spreadY = (i - fanLines / 2) * 0.35;
      const pts = [
        new THREE.Vector3(aethonPos.x, aethonPos.y, aethonPos.z),
        new THREE.Vector3(commTarget.x - 1.2, commTarget.y + spreadY, commTarget.z),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x7fb7d4,
        transparent: true,
        opacity: 0.35,
      });
      const fanLine = new THREE.Line(lineGeo, lineMat);
      commFanGroup.add(fanLine);
      disposables.push(lineGeo, lineMat);
    }

    // 5. RECONSTRUCTED ORBITAL TRAJECTORY CURVES
    const curvePoints = [
      new THREE.Vector3(-13.0, 5.8, 0.5),
      new THREE.Vector3(-7.5, 4.2, 0.4),
      new THREE.Vector3(-3.2, -0.4, 0.4),  // AETHON
      new THREE.Vector3(0.2, -1.8, 0.2),   // JOI region
      new THREE.Vector3(3.8, -2.6, -0.2),  // In-flight
      new THREE.Vector3(6.8, -2.2, -0.8),  // Closest approach near Europa
      new THREE.Vector3(8.6, 0.2, -1.4),   // Capture curve
    ];
    const trajectoryCurve = new THREE.CatmullRomCurve3(curvePoints);
    const curvePts = trajectoryCurve.getPoints(140);

    // Past/Current Solid Line (Index 0 to 60, up to AETHON)
    const solidPts = curvePts.slice(0, 61);
    const solidGeo = new THREE.BufferGeometry().setFromPoints(solidPts);
    const solidMat = new THREE.LineBasicMaterial({
      color: 0x7fb7d4,
      linewidth: 2,
    });
    const solidLine = new THREE.Line(solidGeo, solidMat);
    scene.add(solidLine);
    disposables.push(solidGeo, solidMat);

    // Future Projected Dashed Line (Index 60 to end)
    const dashedPts = curvePts.slice(60);
    const dashedGeo = new THREE.BufferGeometry().setFromPoints(dashedPts);
    const dashedMat = new THREE.LineDashedMaterial({
      color: 0x7fb7d4,
      dashSize: 0.35,
      gapSize: 0.22,
      transparent: true,
      opacity: 0.85,
    });
    const dashedLine = new THREE.Line(dashedGeo, dashedMat);
    dashedLine.computeLineDistances();
    scene.add(dashedLine);
    disposables.push(dashedGeo, dashedMat);

    // Secondary Jovian Tour Resonance Guide
    const joviGuidePts = [
      new THREE.Vector3(-11, 1.2, 0),
      new THREE.Vector3(-3.5, 3.2, 0),
      new THREE.Vector3(5.0, 3.6, -4.0),
      new THREE.Vector3(11, 2.0, -7.5),
    ];
    const joviCurve = new THREE.CatmullRomCurve3(joviGuidePts);
    const joviGeo = new THREE.BufferGeometry().setFromPoints(joviCurve.getPoints(60));
    const joviMat = new THREE.LineDashedMaterial({
      color: 0x3b4c5e,
      dashSize: 0.3,
      gapSize: 0.3,
      transparent: true,
      opacity: 0.45,
    });
    const joviLine = new THREE.Line(joviGeo, joviMat);
    joviLine.computeLineDistances();
    scene.add(joviLine);
    disposables.push(joviGeo, joviMat);

    // 6. AETHON SPACECRAFT 3D MINI-MARKER
    const aethonGroup = new THREE.Group();
    aethonGroup.position.copy(aethonPos);

    const busMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.8 })
    );
    aethonGroup.add(busMesh);
    disposables.push(busMesh.geometry, busMesh.material);

    const wingMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.02, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x0c1b33, metalness: 0.6 })
    );
    aethonGroup.add(wingMesh);
    disposables.push(wingMesh.geometry, wingMesh.material);

    const velArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0.8, -0.4, 0).normalize(),
      new THREE.Vector3(0, 0, 0),
      0.8,
      0x31c48d
    );
    aethonGroup.add(velArrow);

    scene.add(aethonGroup);

    // 7. WORLD-TO-SCREEN DYNAMIC PROJECTION HELPER
    const projectAnchor = (worldPos: THREE.Vector3, offsetX = 0, offsetY = 0) => {
      const v = worldPos.clone().project(camera);
      const isBehind = v.z > 1.0;
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      const screenX = (v.x * 0.5 + 0.5) * w + offsetX;
      const screenY = (-v.y * 0.5 + 0.5) * h + offsetY;
      const isVisible = !isBehind && screenX >= -80 && screenX <= w + 80 && screenY >= -80 && screenY <= h + 80;
      return { x: screenX, y: screenY, isVisible };
    };

    // 8. ANIMATION LOOP WITH 60FPS DOM TRANSFORM UPDATES
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const state = controlsStateRef.current;

      // Smooth zoom interpolation
      state.zoom += (state.targetZoom - state.zoom) * 0.12;

      // Gentle planetary axial rotation
      if (isSimulating) {
        jupiterMesh.rotation.y += delta * 0.04;
        europaMesh.rotation.y += delta * 0.02;
      }

      // Camera positioning via spherical coordinate orbit around opticalCentroid
      const targetLook = state.isFollow
        ? anchorsRef.current.aethon
        : anchorsRef.current.opticalCentroid;

      const cosX = Math.cos(state.rotationX);
      const sinX = Math.sin(state.rotationX);
      const cosY = Math.cos(state.rotationY);
      const sinY = Math.sin(state.rotationY);

      camera.position.x = targetLook.x + state.zoom * cosX * sinY;
      camera.position.y = targetLook.y + state.zoom * sinX;
      camera.position.z = targetLook.z + state.zoom * cosX * cosY;
      camera.lookAt(targetLook);

      // Face Europa halo towards camera in True Scale
      if (europaHaloGroup) {
        europaHaloGroup.quaternion.copy(camera.quaternion);
      }

      // Update HUD compass readings
      const azimuthDeg = (state.rotationY * (180 / Math.PI)) % 360;
      const elevationDeg = state.rotationX * (180 / Math.PI);
      setCameraAzimuth(azimuthDeg);
      setCameraElevation(elevationDeg);

      // Layer visibility toggles
      radiationGroup.visible = isRadiationOn;
      commFanGroup.visible = isCommWindowsOn && isCommWindowActive;

      // WORLD-TO-SCREEN PROJECTION FOR ANNOTATIONS
      const anchors = anchorsRef.current;

      const updateBadge = (ref: React.RefObject<HTMLDivElement | null>, worldPos: THREE.Vector3, offX = 0, offY = 0) => {
        if (!ref.current) return;
        const { x, y, isVisible } = projectAnchor(worldPos, offX, offY);
        ref.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        ref.current.style.display = isVisible ? 'flex' : 'none';
      };

      updateBadge(badgeRefs.tmi, anchors.tmi, -40, -18);
      updateBadge(badgeRefs.joi, anchors.joi, 0, -22);
      updateBadge(badgeRefs.commWindow, anchors.commWindow, -60, -15);
      updateBadge(badgeRefs.radiation, anchors.radiation, 0, 45);
      updateBadge(badgeRefs.eoc, anchors.eoc, -80, -20);
      updateBadge(badgeRefs.aethon, anchors.aethon, -24, -24);
      updateBadge(badgeRefs.targetEuropa, anchors.targetEuropa, 25, -20);
      updateBadge(badgeRefs.closestApproach, anchors.closestApproach, -40, 20);

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Responsive Resize Handler
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

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
    };
  }, [scaleMode, isSimulating, isRadiationOn, isCommWindowsOn, isCommWindowActive]);

  // Global Pointer Listeners for smooth drag
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const state = controlsStateRef.current;
      if (!state.isDragging) return;

      const deltaX = e.clientX - state.previousMouseX;
      const deltaY = e.clientY - state.previousMouseY;

      state.rotationY += deltaX * 0.007;
      // Clamped pitch to prevent flipping
      state.rotationX = Math.max(-0.15, Math.min(0.85, state.rotationX + deltaY * 0.007));

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

  // Wheel Zoom Listener with compositional boundary limits
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = controlsStateRef.current;
      const zoomDelta = e.deltaY * 0.012;
      // Bounded zoom envelope: minZoom 18.0 (no planet clipping), maxZoom 42.0 (no deep-space vanishing)
      state.targetZoom = Math.max(18.0, Math.min(42.0, state.targetZoom + zoomDelta));
      state.lastInteractionTime = Date.now();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const state = controlsStateRef.current;
    state.isDragging = true;
    state.previousMouseX = e.clientX;
    state.previousMouseY = e.clientY;
    state.lastInteractionTime = Date.now();
  };

  const handleResetCamera = useCallback(() => {
    const state = controlsStateRef.current;
    state.rotationX = 0.28;
    state.rotationY = 0.52;
    state.targetZoom = 26.0;
    setIsFollowAethon(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#05070A] cursor-grab active:cursor-grabbing select-none"
      onMouseDown={handleMouseDown}
      data-testid="trajectory-3d-canvas"
    >
      {webglSupported ? (
        <canvas ref={canvasRef} className="block w-full h-full" />
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center bg-[#05070A] text-[#A9B0B5] p-6 select-none"
          data-testid="trajectory-webgl-fallback"
        >
          <div className="w-16 h-16 rounded border border-[#7FB7D4] flex items-center justify-center text-[#7FB7D4] mb-3">
            <RotateCcw size={28} />
          </div>
          <h3 className="font-display text-lg font-bold uppercase text-[#E6E2D6] tracking-wider">
            Jovian Transfer & Europa Approach Schematics
          </h3>
          <p className="font-mono text-xs max-w-sm text-center text-[#6B757D] mt-1">
            WebGL rendering unavailable in current environment. Authoritative navigation telemetry, maneuver
            scheduling, and flight certification remain fully operational.
          </p>
        </div>
      )}

      {/* 1. TOP-LEFT HUD: GIMBAL COMPASS (Screen-Space Fixed) */}
      <div className="absolute top-4 left-6 z-20 pointer-events-none flex flex-col gap-2">
        <GimbalCompass rotationDeg={cameraAzimuth} pitchDeg={cameraElevation} />
      </div>

      {/* 2. DYNAMICALLY PROJECTED 3D WORLD-SPACE HUD ANNOTATIONS */}
      {/* TMI Burn Annotation */}
      <div
        ref={badgeRefs.tmi}
        onClick={() => onSelectManeuverNode?.('mnv-tji-01')}
        className="absolute top-0 left-0 z-10 pointer-events-auto cursor-pointer font-mono text-[10px] tracking-wider text-[#A9B0B5] hover:text-[#FFFFFF] transition-colors will-change-transform"
        style={{ transform: 'translate3d(240px, 120px, 0)' }}
      >
        TMI BURN
      </div>

      {/* JOI Burn Node & Checkmark */}
      <div
        ref={badgeRefs.joi}
        onClick={() => onSelectManeuverNode?.('mnv-joi-01')}
        className="absolute top-0 left-0 z-10 pointer-events-auto cursor-pointer flex items-center gap-1 font-mono text-[10px] tracking-wider text-[#E6E2D6] hover:text-[#31C48D] transition-colors will-change-transform"
        style={{ transform: 'translate3d(380px, 115px, 0)' }}
      >
        <span>JOI (JUPITER ORBIT INSERTION)</span>
        <span className="text-[#31C48D] font-bold">[ ✓ ]</span>
      </div>

      {/* Communication Window Callout */}
      {isCommWindowsOn && (
        <div
          ref={badgeRefs.commWindow}
          className="absolute top-0 left-0 z-10 pointer-events-none flex flex-col items-center gap-0.5 will-change-transform"
          style={{ transform: 'translate3d(410px, 190px, 0)' }}
        >
          <span className="font-mono text-[9px] text-[#7FB7D4] tracking-widest uppercase">
            COMMUNICATION WINDOW
          </span>
          <span className="font-mono text-[9px] text-[#7FB7D4] font-bold">
            [{isCommWindowActive ? ' ACTIVE ' : ' PENDING '}]
          </span>
        </div>
      )}

      {/* Radiation Exposure Callout */}
      {isRadiationOn && (
        <div
          ref={badgeRefs.radiation}
          className="absolute top-0 left-0 z-10 pointer-events-none font-mono text-[9px] tracking-widest text-[#DF8435] uppercase will-change-transform"
          style={{ transform: 'translate3d(490px, 290px, 0)' }}
        >
          RADIATION EXPOSURE
        </div>
      )}

      {/* EOI Flyby / Gameplay Staging Corridor Badge */}
      <div
        ref={badgeRefs.eoc}
        onClick={() => onSelectManeuverNode?.('mnv-flyby-01')}
        className="absolute top-0 left-0 z-10 pointer-events-auto cursor-pointer flex flex-col gap-1 items-start will-change-transform"
        style={{ transform: 'translate3d(180px, 280px, 0)' }}
      >
        <span className="font-mono text-[9px] text-[#8D96A0] tracking-wider">
          EUROPA RECONNAISSANCE CORRIDOR (GAMEPLAY ABSTRACTION)
        </span>
        <div className="px-2.5 py-1 bg-[#0A1017]/90 border border-[#7FB7D4] rounded-xs font-mono text-[10px] text-[#7FB7D4] font-bold tracking-wider hover:bg-[#111C28] transition-colors">
          EOC (EUROPA ORBIT INSERTION) BURN [GAMEPLAY STAGING]
        </div>
      </div>

      {/* AETHON "YOU ARE HERE" HUD Target Reticle */}
      <div
        ref={badgeRefs.aethon}
        className="absolute top-0 left-0 z-10 pointer-events-none flex items-center gap-2 will-change-transform"
        style={{ transform: 'translate3d(320px, 330px, 0)' }}
      >
        <div className="relative w-12 h-12 border border-[#7FB7D4]/60 bg-[#7FB7D4]/5 rounded-xs">
          <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#7FB7D4]" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#7FB7D4]" />
          <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#7FB7D4]" />
          <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#7FB7D4]" />
        </div>
        <div className="flex flex-col font-mono">
          <span className="text-[11px] text-[#E6E2D6] font-bold tracking-[0.16em]">YOU ARE</span>
          <span className="text-[11px] text-[#7FB7D4] font-bold tracking-[0.16em]">HERE</span>
        </div>
      </div>

      {/* Target Europa Telemetry Box */}
      <div
        ref={badgeRefs.targetEuropa}
        className="absolute top-0 left-0 z-10 pointer-events-none flex flex-col font-mono text-[10px] leading-tight text-[#E6E2D6] will-change-transform"
        style={{ transform: 'translate3d(660px, 270px, 0)' }}
      >
        <span className="font-bold tracking-widest text-[#E6E2D6] uppercase">TARGET: EUROPA</span>
        <span className="text-[#8D96A0]">PE: 120 km</span>
        <span className="text-[#8D96A0]">AP: 14,800 km</span>
        {scaleMode === 'true' && (
          <span className="text-[#7FB7D4] text-[9px] font-bold mt-0.5">[ ⌖ 1:1 TRUE SCALE ]</span>
        )}
      </div>

      {/* Closest Approach Reticle */}
      <div
        ref={badgeRefs.closestApproach}
        className="absolute top-0 left-0 z-10 pointer-events-none flex items-center gap-1.5 font-mono text-[10px] text-[#E6E2D6] will-change-transform"
        style={{ transform: 'translate3d(620px, 390px, 0)' }}
      >
        <div className="w-4 h-4 rounded-full border border-[#7FB7D4] flex items-center justify-center text-[10px] text-[#7FB7D4]">
          ⌖
        </div>
        <span>CLOSEST APPROACH: 420 km</span>
      </div>

      {/* 3. BOTTOM-LEFT INTERACTION & LAYER BUTTONS (Screen-Space Fixed) */}
      <div className="absolute bottom-5 left-6 z-20 flex flex-col gap-1.5 pointer-events-auto font-mono text-[10px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetCamera}
            className="px-2.5 py-1 rounded-xs bg-[#0D1116]/90 border border-[#2B3642] hover:border-[#7FB7D4] text-[#A9B0B5] hover:text-[#FFFFFF] uppercase tracking-wider transition-colors cursor-pointer"
          >
            FREE ORBIT ↻
          </button>
          <button
            type="button"
            onClick={() => setIsFollowAethon((prev) => !prev)}
            className={`px-2.5 py-1 rounded-xs border uppercase tracking-wider transition-colors cursor-pointer ${
              isFollowAethon
                ? 'bg-[#1C2530] text-[#7FB7D4] border-[#7FB7D4] font-bold'
                : 'bg-[#0D1116]/90 border-[#2B3642] text-[#A9B0B5] hover:text-[#FFFFFF]'
            }`}
          >
            FOLLOW AETHON ⚓
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsDeltaVOn((prev) => !prev)}
            className={`px-2.5 py-1 rounded-xs border uppercase tracking-wider transition-colors cursor-pointer ${
              isDeltaVOn
                ? 'bg-[#1C2530] text-[#7FB7D4] border-[#7FB7D4]'
                : 'bg-[#0D1116]/90 border-[#2B3642] text-[#6B757D]'
            }`}
          >
            [{isDeltaVOn ? ' DELTA-V ON ' : ' DELTA-V OFF '}]
          </button>

          <button
            type="button"
            onClick={() => setIsCommWindowsOn((prev) => !prev)}
            className={`px-2.5 py-1 rounded-xs border uppercase tracking-wider transition-colors cursor-pointer ${
              isCommWindowsOn
                ? 'bg-[#1C2530] text-[#7FB7D4] border-[#7FB7D4]'
                : 'bg-[#0D1116]/90 border-[#2B3642] text-[#6B757D]'
            }`}
          >
            [{isCommWindowsOn ? ' COMM WINDOWS ON ' : ' COMM WINDOWS OFF '}]
          </button>
        </div>
      </div>

      {/* 4. BOTTOM-RIGHT RADIATION LAYER TOGGLE (Screen-Space Fixed) */}
      <div className="absolute bottom-5 right-6 z-20 pointer-events-auto font-mono text-[10px]">
        <button
          type="button"
          onClick={() => setIsRadiationOn((prev) => !prev)}
          className={`px-2.5 py-1 rounded-xs border uppercase tracking-wider transition-colors cursor-pointer ${
            isRadiationOn
              ? 'bg-[#1C2530] text-[#DF8435] border-[#DF8435]'
              : 'bg-[#0D1116]/90 border-[#2B3642] text-[#6B757D]'
          }`}
        >
          [{isRadiationOn ? ' RADIATION ON ' : ' RADIATION OFF '}]
        </button>
      </div>
    </div>
  );
};
