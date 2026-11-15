import * as THREE from 'three';

/**
 * Creates a subtle, realistic deep-space starfield.
 * Distributes pin-sharp stars with varied magnitudes and spectral tints across the celestial sphere.
 */
export function createStarfieldMesh(count = 1800, radius = 220): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const spectralPalette = [
    new THREE.Color(0xffffff), // Crisp white (A/F class)
    new THREE.Color(0xdcebff), // Pale icy blue (B/A class)
    new THREE.Color(0xfef5e7), // Soft warm ivory (G class)
    new THREE.Color(0xffe8cc), // Faint warm amber (K class)
  ];

  for (let i = 0; i < count; i++) {
    // Uniform spherical distribution
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = radius * (0.8 + Math.random() * 0.4);

    const sinPhi = Math.sin(phi);
    positions[i * 3] = r * sinPhi * Math.cos(theta);
    positions[i * 3 + 1] = r * sinPhi * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Color variation
    const colorPick = spectralPalette[Math.floor(Math.random() * spectralPalette.length)];
    const brightness = 0.4 + Math.random() * 0.6;
    colors[i * 3] = colorPick.r * brightness;
    colors[i * 3 + 1] = colorPick.g * brightness;
    colors[i * 3 + 2] = colorPick.b * brightness;

    // Subtle star size variation
    sizes[i] = 0.8 + Math.random() * 1.6;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Circular point sprite texture
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
  }
  const starTexture = new THREE.CanvasTexture(canvas);

  const material = new THREE.PointsMaterial({
    size: 1.5,
    vertexColors: true,
    map: starTexture,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: false,
  });

  return new THREE.Points(geometry, material);
}
