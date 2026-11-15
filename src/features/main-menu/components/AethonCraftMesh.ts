import * as THREE from 'three';

export interface AethonCraftBundle {
  group: THREE.Group;
  update: (elapsed: number, delta: number) => void;
  dispose: () => void;
}

/**
 * Creates the procedural engineering model of the AETHON spacecraft
 * matching the visual reference image:
 * - Cylindrical main avionics & propulsion bus
 * - Multilayer insulation (MLI) gold foil and titanium paneling
 * - Dual extended photovoltaic solar array wings
 * - Parabolic high-gain antenna dish with feed horn
 * - Forward instrument science booms
 * - Aft rocket nozzle cluster with subtle cyan/blue thruster glow
 */
export function createAethonCraftMesh(): AethonCraftBundle {
  const group = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

  // PBR Materials
  const titaniumHullMat = new THREE.MeshStandardMaterial({
    color: 0x222831,
    metalness: 0.88,
    roughness: 0.28,
  });
  disposables.push(titaniumHullMat);

  const darkStructureMat = new THREE.MeshStandardMaterial({
    color: 0x14181f,
    metalness: 0.8,
    roughness: 0.45,
  });
  disposables.push(darkStructureMat);

  const mliGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.92,
    roughness: 0.32,
  });
  disposables.push(mliGoldMat);

  const solarCellMat = new THREE.MeshStandardMaterial({
    color: 0x0c1b33,
    metalness: 0.65,
    roughness: 0.18,
  });
  disposables.push(solarCellMat);

  const solarBackingMat = new THREE.MeshStandardMaterial({
    color: 0xb57328,
    metalness: 0.75,
    roughness: 0.4,
  });
  disposables.push(solarBackingMat);

  const dishAntennaMat = new THREE.MeshStandardMaterial({
    color: 0xd8dde6,
    metalness: 0.35,
    roughness: 0.45,
  });
  disposables.push(dishAntennaMat);

  const thrusterMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1c1e24,
    metalness: 0.95,
    roughness: 0.22,
  });
  disposables.push(thrusterMetalMat);

  // 1. Central Bus (Titanium cylinder)
  const busGeo = new THREE.CylinderGeometry(0.38, 0.42, 1.4, 24);
  busGeo.rotateZ(Math.PI / 2); // Align horizontally along X
  const busMesh = new THREE.Mesh(busGeo, titaniumHullMat);
  group.add(busMesh);
  disposables.push(busGeo);

  // 2. Midsection MLI Gold Foil Blanket
  const mliGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.65, 24);
  mliGeo.rotateZ(Math.PI / 2);
  const mliMesh = new THREE.Mesh(mliGeo, mliGoldMat);
  group.add(mliMesh);
  disposables.push(mliGeo);

  // 3. Forward Avionics Equipment Deck (Right/Front)
  const forwardDeckGeo = new THREE.ConeGeometry(0.38, 0.35, 24);
  forwardDeckGeo.rotateZ(-Math.PI / 2);
  forwardDeckGeo.translate(0.85, 0, 0);
  const forwardDeckMesh = new THREE.Mesh(forwardDeckGeo, darkStructureMat);
  group.add(forwardDeckMesh);
  disposables.push(forwardDeckGeo);

  // 4. Parabolic High-Gain Antenna (HGA) Dish
  // Dish mounted on dorsal side (+Y) angled toward Earth
  const dishGroup = new THREE.Group();
  dishGroup.position.set(-0.15, 0.52, 0);
  dishGroup.rotation.z = -0.35; // angled forward
  dishGroup.rotation.x = 0.25;

  const dishGeo = new THREE.CylinderGeometry(0.58, 0.08, 0.12, 32, 1, true);
  const dishMesh = new THREE.Mesh(dishGeo, dishAntennaMat);
  dishGroup.add(dishMesh);
  disposables.push(dishGeo);

  // Feed horn tripod
  const hornGeo = new THREE.ConeGeometry(0.04, 0.25, 8);
  hornGeo.translate(0, 0.14, 0);
  const hornMesh = new THREE.Mesh(hornGeo, darkStructureMat);
  dishGroup.add(hornMesh);
  disposables.push(hornGeo);

  group.add(dishGroup);

  // 5. Solar Array Wings (Port and Starboard along Z axis)
  const wingWidth = 0.65;
  const wingLength = 1.65;
  const wingThickness = 0.025;

  [-1, 1].forEach((side) => {
    const wingGroup = new THREE.Group();
    // Position offset from central bus
    const zOffset = side * (0.55 + wingLength / 2);
    wingGroup.position.set(0, 0, zOffset);

    // Connecting strut
    const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 12);
    strutGeo.rotateX(Math.PI / 2);
    strutGeo.translate(0, 0, -side * (wingLength / 2 + 0.15));
    const strutMesh = new THREE.Mesh(strutGeo, darkStructureMat);
    wingGroup.add(strutMesh);
    disposables.push(strutGeo);

    // Solar panel frame
    const panelGeo = new THREE.BoxGeometry(wingWidth, wingThickness, wingLength);
    const panelMesh = new THREE.Mesh(panelGeo, solarCellMat);
    wingGroup.add(panelMesh);
    disposables.push(panelGeo);

    // Gold Kapton backing plate
    const backingGeo = new THREE.BoxGeometry(wingWidth * 0.98, wingThickness * 0.5, wingLength * 0.98);
    backingGeo.translate(0, -wingThickness * 0.35, 0);
    const backingMesh = new THREE.Mesh(backingGeo, solarBackingMat);
    wingGroup.add(backingMesh);
    disposables.push(backingGeo);

    // Subtle sun-tracking tilt
    wingGroup.rotation.x = 0.18;
    group.add(wingGroup);
  });

  // 6. Aft Main Propulsion Bell Nozzle (Left/Aft: -X)
  const nozzleGeo = new THREE.ConeGeometry(0.24, 0.42, 24, 1, true);
  nozzleGeo.rotateZ(Math.PI / 2);
  nozzleGeo.translate(-0.85, 0, 0);
  const nozzleMesh = new THREE.Mesh(nozzleGeo, thrusterMetalMat);
  group.add(nozzleMesh);
  disposables.push(nozzleGeo);

  // Engine throat inner core
  const throatGeo = new THREE.SphereGeometry(0.08, 12, 12);
  throatGeo.translate(-0.7, 0, 0);
  const throatMat = new THREE.MeshBasicMaterial({ color: 0x35c6f4 });
  const throatMesh = new THREE.Mesh(throatGeo, throatMat);
  group.add(throatMesh);
  disposables.push(throatGeo, throatMat);

  // Subtle thruster glow light
  const thrusterLight = new THREE.PointLight(0x35c6f4, 1.4, 4.5);
  thrusterLight.position.set(-0.95, 0, 0);
  group.add(thrusterLight);

  // 7. Forward Science Boom (Magnetometer mast)
  const boomGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.3, 8);
  boomGeo.rotateZ(-Math.PI / 2);
  boomGeo.translate(1.65, 0, 0.1);
  const boomMesh = new THREE.Mesh(boomGeo, darkStructureMat);
  group.add(boomMesh);
  disposables.push(boomGeo);

  // Sensor head at boom tip
  const sensorGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  sensorGeo.translate(2.32, 0, 0.1);
  const sensorMesh = new THREE.Mesh(sensorGeo, mliGoldMat);
  group.add(sensorMesh);
  disposables.push(sensorGeo);

  // Initial Craft Orientation matching reference
  // Spacecraft travels rightward, slight bank angle
  group.rotation.y = 0.12;
  group.rotation.x = -0.15;
  group.rotation.z = 0.08;

  // Base position
  const baseRotationY = group.rotation.y;
  const baseRotationX = group.rotation.x;
  const baseRotationZ = group.rotation.z;

  const update = (elapsed: number, _delta: number) => {
    // Ultra-subtle attitude drift (reaction wheel precision drift)
    group.rotation.y = baseRotationY + Math.sin(elapsed * 0.35) * 0.012;
    group.rotation.x = baseRotationX + Math.cos(elapsed * 0.28) * 0.008;
    group.rotation.z = baseRotationZ + Math.sin(elapsed * 0.22) * 0.006;

    // Faint pulse on thruster idle light
    thrusterLight.intensity = 1.2 + Math.sin(elapsed * 2.5) * 0.25;
  };

  const dispose = () => {
    disposables.forEach((item) => item.dispose());
  };

  return {
    group,
    update,
    dispose,
  };
}
