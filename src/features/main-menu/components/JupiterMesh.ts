import * as THREE from 'three';

/**
 * Creates a procedural fallback texture for Jupiter in case image loading is delayed or offline.
 * Renders authentic Jovian latitudinal belts, white zones, turbulent eddies, and the Great Red Spot.
 */
function createProceduralJupiterTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  // Base background
  ctx.fillStyle = '#C89D7C';
  ctx.fillRect(0, 0, width, height);

  // Band definitions: [yStartPercent, yEndPercent, color, turbulence]
  const bands: [number, number, string, number][] = [
    [0.00, 0.12, '#8E674D', 0.2], // North Polar Region
    [0.12, 0.22, '#D7BEA8', 0.4], // North North Temperate Belt
    [0.22, 0.30, '#9A6B48', 0.5], // North Temperate Belt
    [0.30, 0.38, '#F0DEC8', 0.3], // North Tropical Zone
    [0.38, 0.46, '#7F4522', 0.6], // North Equatorial Belt (Dark, turbulent)
    [0.46, 0.54, '#FDF2DC', 0.4], // Equatorial Zone (Bright cream)
    [0.54, 0.62, '#8C4D28', 0.6], // South Equatorial Belt (Rich brown-ochre)
    [0.62, 0.70, '#EBD2BA', 0.3], // South Tropical Zone
    [0.70, 0.78, '#9E7153', 0.5], // South Temperate Belt
    [0.78, 0.88, '#CDB098', 0.3], // South South Temperate Belt
    [0.88, 1.00, '#7A543A', 0.2], // South Polar Region
  ];

  bands.forEach(([y0, y1, color]) => {
    const startY = y0 * height;
    const bandHeight = (y1 - y0) * height;
    ctx.fillStyle = color;
    ctx.fillRect(0, startY, width, bandHeight);

    // Micro-banding & turbulent variation
    for (let sub = 0; sub < 4; sub++) {
      ctx.fillStyle = sub % 2 === 0 ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, startY + (sub * bandHeight) / 4, width, bandHeight / 4);
    }
  });

  // Great Red Spot (GRS) in South Tropical Zone (~y: 60-66%, x: ~45-55%)
  const grsX = width * 0.52;
  const grsY = height * 0.63;
  const grsRadiusX = width * 0.06;
  const grsRadiusY = height * 0.045;

  const grsGrad = ctx.createRadialGradient(grsX, grsY, 0, grsX, grsY, grsRadiusX);
  grsGrad.addColorStop(0, '#C24D2C');
  grsGrad.addColorStop(0.5, '#A63F24');
  grsGrad.addColorStop(0.85, '#87341D');
  grsGrad.addColorStop(1, 'rgba(140, 77, 40, 0)');

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(grsX, grsY, grsRadiusX, grsRadiusY, -0.05, 0, Math.PI * 2);
  ctx.fillStyle = grsGrad;
  ctx.fill();

  // White storm core
  ctx.beginPath();
  ctx.ellipse(grsX + 2, grsY - 1, grsRadiusX * 0.35, grsRadiusY * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 230, 210, 0.35)';
  ctx.fill();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export interface JupiterMeshBundle {
  group: THREE.Group;
  planetMesh: THREE.Mesh;
  atmosphereMesh: THREE.Mesh;
  update: (delta: number) => void;
  dispose: () => void;
}

/**
 * Creates the cinematic Jupiter system matching the reference visual:
 * - Upper-right quadrant framing
 * - Photorealistic cloud banding and Great Red Spot
 * - Atmospheric rim scattering lit from top-left with dark terminator
 */
export function createJupiterMesh(radius = 16): JupiterMeshBundle {
  const group = new THREE.Group();

  // 1. Procedural baseline texture
  const proceduralTexture = createProceduralJupiterTexture();

  // 2. Planet sphere geometry and material
  const sphereGeometry = new THREE.SphereGeometry(radius, 64, 64);
  const planetMaterial = new THREE.MeshStandardMaterial({
    map: proceduralTexture,
    roughness: 0.88,
    metalness: 0.02,
  });

  const planetMesh = new THREE.Mesh(sphereGeometry, planetMaterial);
  // Slight axial tilt for Jupiter (~3.13 deg)
  planetMesh.rotation.z = (3.13 * Math.PI) / 180;
  // Position Great Red Spot facing forward/left toward illuminated view
  planetMesh.rotation.y = 1.35;
  group.add(planetMesh);

  // 3. Attempt to load official high-res texture from public assets
  const textureLoader = new THREE.TextureLoader();
  let loadedTexture: THREE.Texture | null = null;
  textureLoader.load(
    '/assets/images/jupiter.jpg',
    (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      planetMaterial.map = tex;
      planetMaterial.needsUpdate = true;
      loadedTexture = tex;
    },
    undefined,
    () => {
      // In case image load fails, procedural texture remains active seamlessly
    }
  );

  // 4. Photorealistic Atmospheric Limb Glow (Fresnel rim scattering)
  const sunDirection = new THREE.Vector3(-0.75, 0.55, 0.35).normalize();

  const atmosphereShader = {
    uniforms: {
      uSunDirection: { value: sunDirection },
      uGlowColor: { value: new THREE.Color(0xd6bba2) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform vec3 uGlowColor;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        // Fresnel rim term
        float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
        fresnel = pow(fresnel, 3.2);

        // Sunlight orientation term: only illuminate the sun-facing limb
        float sunFacing = dot(normal, uSunDirection);
        float sunIntensity = smoothstep(-0.2, 0.4, sunFacing);

        float alpha = fresnel * sunIntensity * 0.75;
        if (alpha < 0.005) discard;

        gl_FragColor = vec4(uGlowColor, alpha);
      }
    `,
  };

  const atmosphereGeometry = new THREE.SphereGeometry(radius * 1.014, 64, 64);
  const atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: atmosphereShader.uniforms,
    vertexShader: atmosphereShader.vertexShader,
    fragmentShader: atmosphereShader.fragmentShader,
    blending: THREE.AdditiveBlending,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  group.add(atmosphereMesh);

  // Update function for slow, majestic axial rotation
  const update = (delta: number) => {
    // Jupiter completes one rotation every ~9.9 hours. At this cinematic scale, use gentle rotation.
    planetMesh.rotation.y += delta * 0.008;
  };

  // Disposal cleanup
  const dispose = () => {
    sphereGeometry.dispose();
    atmosphereGeometry.dispose();
    planetMaterial.dispose();
    atmosphereMaterial.dispose();
    proceduralTexture.dispose();
    if (loadedTexture) {
      loadedTexture.dispose();
    }
  };

  return {
    group,
    planetMesh,
    atmosphereMesh,
    update,
    dispose,
  };
}
