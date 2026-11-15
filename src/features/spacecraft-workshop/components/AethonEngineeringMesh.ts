import * as THREE from 'three';
import type { ComponentCategory } from '../../../types/game';

export interface AethonModelBundle {
  rootGroup: THREE.Group;
  subsystemGroups: Record<ComponentCategory, THREE.Group>;
  highlightBox?: THREE.BoxHelper;
  updateHighlight: (category: ComponentCategory) => void;
  update: (elapsed: number) => void;
  dispose: () => void;
}

/**
 * Creates the canvas texture for the AETHON spacecraft hull stencil.
 */
function createHullStencilTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#C8CCD2';
    ctx.fillRect(0, 0, 512, 256);

    // Panel seam lines
    ctx.strokeStyle = '#8E949D';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 492, 236);
    ctx.beginPath();
    ctx.moveTo(256, 10);
    ctx.lineTo(256, 246);
    ctx.stroke();

    // Stenciled vehicle name
    ctx.fillStyle = '#2B313B';
    ctx.font = 'bold 54px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AETHON', 140, 128);

    // Mission code
    ctx.font = '22px monospace';
    ctx.fillStyle = '#5A6372';
    ctx.fillText('EXP-V // EUROPA', 380, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

/**
 * Procedural high-detail 3D engineering model of the AETHON spacecraft.
 * Adapted from the NASA Europa Clipper architecture with modular subsystem groups.
 */
export function createAethonEngineeringModel(): AethonModelBundle {
  const rootGroup = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  // PBR Materials
  const hullStencilTex = createHullStencilTexture();
  disposables.push(hullStencilTex);

  const hullMat = new THREE.MeshStandardMaterial({
    map: hullStencilTex,
    metalness: 0.75,
    roughness: 0.32,
  });
  disposables.push(hullMat);

  const darkTitaniumMat = new THREE.MeshStandardMaterial({
    color: 0x1f242d,
    metalness: 0.88,
    roughness: 0.25,
  });
  disposables.push(darkTitaniumMat);

  const solarCellMat = new THREE.MeshStandardMaterial({
    color: 0x0c1b33,
    metalness: 0.65,
    roughness: 0.18,
  });
  disposables.push(solarCellMat);

  const goldKaptonMat = new THREE.MeshStandardMaterial({
    color: 0xc48228,
    metalness: 0.9,
    roughness: 0.35,
  });
  disposables.push(goldKaptonMat);

  const antennaMat = new THREE.MeshStandardMaterial({
    color: 0xe2e6eb,
    metalness: 0.4,
    roughness: 0.35,
  });
  disposables.push(antennaMat);

  const thrusterMat = new THREE.MeshStandardMaterial({
    color: 0x181a1f,
    metalness: 0.95,
    roughness: 0.2,
  });
  disposables.push(thrusterMat);

  // Subsystem Groups
  const structureGroup = new THREE.Group();
  const powerGroup = new THREE.Group();
  const propulsionGroup = new THREE.Group();
  const communicationGroup = new THREE.Group();
  const thermalGroup = new THREE.Group();
  const instrumentsGroup = new THREE.Group();

  rootGroup.add(structureGroup);
  rootGroup.add(powerGroup);
  rootGroup.add(propulsionGroup);
  rootGroup.add(communicationGroup);
  rootGroup.add(thermalGroup);
  rootGroup.add(instrumentsGroup);

  // 1. STRUCTURE: Main Central Bus Vault (Rectangular body with beveled avionics deck)
  const busGeo = new THREE.BoxGeometry(2.2, 1.4, 1.5);
  const busMesh = new THREE.Mesh(busGeo, hullMat);
  structureGroup.add(busMesh);
  disposables.push(busGeo);

  // Forward radiation vault shield
  const vaultGeo = new THREE.BoxGeometry(0.8, 1.2, 1.3);
  vaultGeo.translate(1.4, 0, 0);
  const vaultMesh = new THREE.Mesh(vaultGeo, darkTitaniumMat);
  structureGroup.add(vaultMesh);
  disposables.push(vaultGeo);

  // Ventral Lander Capsule / Descent Package
  const landerBaseGeo = new THREE.CylinderGeometry(0.7, 0.9, 0.45, 16);
  landerBaseGeo.translate(0.1, -0.9, 0);
  const landerMesh = new THREE.Mesh(landerBaseGeo, goldKaptonMat);
  structureGroup.add(landerMesh);
  disposables.push(landerBaseGeo);

  // Lander 4 landing legs
  [-0.6, 0.6].forEach((x) => {
    [-0.6, 0.6].forEach((z) => {
      const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
      legGeo.rotateZ(x > 0 ? -0.4 : 0.4);
      legGeo.rotateX(z > 0 ? 0.4 : -0.4);
      legGeo.translate(x * 1.1, -1.2, z * 1.1);
      const legMesh = new THREE.Mesh(legGeo, darkTitaniumMat);
      structureGroup.add(legMesh);
      disposables.push(legGeo);
    });
  });

  // 2. POWER: Huge Twin Photovoltaic Solar Array Wings (Port & Starboard)
  const wingWidth = 1.3;
  const wingLength = 3.6;
  const wingThickness = 0.04;

  [-1, 1].forEach((side) => {
    const wingSubGroup = new THREE.Group();
    wingSubGroup.position.set(0, 0, side * 0.85);

    // Truss connection mast
    const trussGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
    trussGeo.rotateX(Math.PI / 2);
    trussGeo.translate(0, 0, side * 0.4);
    const trussMesh = new THREE.Mesh(trussGeo, darkTitaniumMat);
    wingSubGroup.add(trussMesh);
    disposables.push(trussGeo);

    // Multi-panel solar wing
    const panelGeo = new THREE.BoxGeometry(wingWidth, wingThickness, wingLength);
    panelGeo.translate(0, 0, side * (wingLength / 2 + 0.7));
    const panelMesh = new THREE.Mesh(panelGeo, solarCellMat);
    wingSubGroup.add(panelMesh);
    disposables.push(panelGeo);

    // Gold Kapton backing
    const backGeo = new THREE.BoxGeometry(wingWidth * 0.98, wingThickness * 0.4, wingLength * 0.98);
    backGeo.translate(0, -wingThickness * 0.35, side * (wingLength / 2 + 0.7));
    const backMesh = new THREE.Mesh(backGeo, goldKaptonMat);
    wingSubGroup.add(backMesh);
    disposables.push(backGeo);

    powerGroup.add(wingSubGroup);
  });

  // 3. PROPULSION: Aft Propulsion Module & Main Engine Nozzle (-X)
  const aftHousingGeo = new THREE.CylinderGeometry(0.65, 0.75, 0.8, 16);
  aftHousingGeo.rotateZ(Math.PI / 2);
  aftHousingGeo.translate(-1.45, 0, 0);
  const aftHousingMesh = new THREE.Mesh(aftHousingGeo, darkTitaniumMat);
  propulsionGroup.add(aftHousingMesh);
  disposables.push(aftHousingGeo);

  // Main rocket engine bell
  const bellGeo = new THREE.ConeGeometry(0.42, 0.75, 24, 1, true);
  bellGeo.rotateZ(Math.PI / 2);
  bellGeo.translate(-2.0, 0, 0);
  const bellMesh = new THREE.Mesh(bellGeo, thrusterMat);
  propulsionGroup.add(bellMesh);
  disposables.push(bellGeo);

  // 4 RCS Thruster pods
  [-0.6, 0.6].forEach((y) => {
    [-0.6, 0.6].forEach((z) => {
      const rcsGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
      rcsGeo.translate(-1.2, y, z);
      const rcsMesh = new THREE.Mesh(rcsGeo, darkTitaniumMat);
      propulsionGroup.add(rcsMesh);
      disposables.push(rcsGeo);
    });
  });

  // 4. COMMUNICATIONS: Dorsal Parabolic High-Gain Antenna (HGA) (+Y)
  const hgaGroup = new THREE.Group();
  hgaGroup.position.set(-0.25, 0.75, 0);

  // Parabolic reflector dish
  const dishGeo = new THREE.CylinderGeometry(0.72, 0.12, 0.18, 32, 1, true);
  const dishMesh = new THREE.Mesh(dishGeo, antennaMat);
  hgaGroup.add(dishMesh);
  disposables.push(dishGeo);

  // Sub-reflector tripod & horn
  const hornGeo = new THREE.ConeGeometry(0.06, 0.35, 8);
  hornGeo.translate(0, 0.22, 0);
  const hornMesh = new THREE.Mesh(hornGeo, darkTitaniumMat);
  hgaGroup.add(hornMesh);
  disposables.push(hornGeo);

  communicationGroup.add(hgaGroup);

  // 5. THERMAL: Side Louvered Radiators (+Y/-Y sides)
  [-1, 1].forEach((y) => {
    const radiatorGeo = new THREE.BoxGeometry(1.2, 0.04, 0.65);
    radiatorGeo.translate(0, y * 0.72, 0);
    const radiatorMesh = new THREE.Mesh(radiatorGeo, antennaMat);
    thermalGroup.add(radiatorMesh);
    disposables.push(radiatorGeo);
  });

  // 6. INSTRUMENTS: Forward Ice-Penetrating Radar Boom (IPR-3) & Science Package (+X)
  const boomGroup = new THREE.Group();
  boomGroup.position.set(1.8, 0, 0);

  // Main radar boom truss
  const boomTrussGeo = new THREE.CylinderGeometry(0.04, 0.05, 2.2, 8);
  boomTrussGeo.rotateZ(-Math.PI / 2);
  boomTrussGeo.translate(1.1, 0, 0);
  const boomMesh = new THREE.Mesh(boomTrussGeo, darkTitaniumMat);
  boomGroup.add(boomMesh);
  disposables.push(boomTrussGeo);

  // Radar cross dipole antennas
  const dipoleGeo = new THREE.BoxGeometry(0.03, 1.4, 0.03);
  dipoleGeo.translate(2.1, 0, 0);
  const dipoleMesh = new THREE.Mesh(dipoleGeo, antennaMat);
  boomGroup.add(dipoleMesh);
  disposables.push(dipoleGeo);

  // Sensor package at tip
  const sensorHeadGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  sensorHeadGeo.translate(2.2, 0, 0);
  const sensorHeadMesh = new THREE.Mesh(sensorHeadGeo, goldKaptonMat);
  boomGroup.add(sensorHeadMesh);
  disposables.push(sensorHeadGeo);

  instrumentsGroup.add(boomGroup);

  const subsystemGroups: Record<ComponentCategory, THREE.Group> = {
    instruments: instrumentsGroup,
    power: powerGroup,
    propulsion: propulsionGroup,
    communication: communicationGroup,
    thermal: thermalGroup,
    structure: structureGroup,
  };

  // Unobstructed view: no bounding-box wireframe rendered over spacecraft
  const updateHighlight = (_category: ComponentCategory) => {
    // Retain clean function interface without rendering wireframe overlay
  };

  const update = (_elapsed: number) => {
    // Subtle hover/light updates if needed
  };

  const dispose = () => {
    disposables.forEach((item) => item.dispose());
  };

  return {
    rootGroup,
    subsystemGroups,
    updateHighlight,
    update,
    dispose,
  };
}
