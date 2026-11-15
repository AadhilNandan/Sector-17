/**
 * SECTOR 17 — Europa Surface Exploration & Rover Unit Tests (Phase 6.6)
 * Strict testing of terrain topology, rover mobility, power/thermal dynamics,
 * instrument constraints, non-mutation on failure, and orbital prerequisite enforcement.
 */

import { describe, it, expect } from 'vitest';
import {
  generateEuropaTerrainGrid,
  getTerrainCell,
  validateMoveFeasibility,
} from '../src/simulation/surface/terrainModel';
import {
  createInitialRoverState,
  updateRoverSystems,
  setRoverOperatingMode,
} from '../src/simulation/surface/roverSystems';
import {
  executeRoverTraverse,
} from '../src/simulation/surface/roverMobility';
import {
  executeSurfaceScienceAcquisition,
} from '../src/simulation/surface/surfaceScience';
import {
  SurfaceMissionManager,
} from '../src/simulation/surface/surfaceMissionManager';
import { OnboardStorage } from '../src/simulation/communications/onboardStorage';
import {
  EUROPA_SURFACE_GRAVITY_MPS2,
  EUROPA_SURFACE_PRESSURE_BAR,
  ROVER_BATTERY_CAPACITY_JOULES,
  ROVER_RTG_POWER_OUTPUT_WATTS,
  ROVER_POWER_DEMANDS_WATTS,
  ROVER_SAFE_TEMP_MIN_KELVIN,
  ROVER_MAX_RADIATION_TOLERANCE_RADS,
} from '../src/simulation/surface/constants';

describe('Europa Surface Simulation Engine (Phase 6.6)', () => {
  /* ------------------------------------------------------------------------ */
  /* 1. Europa Environment & Physical Constants                               */
  /* ------------------------------------------------------------------------ */
  describe('Environmental Physical Constants & Provenance', () => {
    it('verifies Europa surface gravity is 1.315 m/s² (Galileo standard)', () => {
      expect(EUROPA_SURFACE_GRAVITY_MPS2).toBeCloseTo(1.315, 3);
    });

    it('verifies Europa surface atmosphere is a near-vacuum ~10^-12 bar', () => {
      expect(EUROPA_SURFACE_PRESSURE_BAR).toBe(1e-12);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 2. Terrain Model & Grid Topology                                         */
  /* ------------------------------------------------------------------------ */
  describe('Terrain Model & Topology Grid', () => {
    it('generates a deterministic 10x10 survey grid with central landing site at [4, 4]', () => {
      const grid = generateEuropaTerrainGrid();
      expect(grid.length).toBe(10);
      expect(grid[0].length).toBe(10);

      const centerCell = getTerrainCell(grid, 4, 4);
      expect(centerCell).toBeDefined();
      expect(centerCell?.elevationMetres).toBe(0.0);
      expect(centerCell?.slopeDeg).toBeLessThan(5.0);
      expect(centerCell?.hasObstacle).toBe(false);
      expect(centerCell?.isSurveyed).toBe(true);
      expect(centerCell?.featureName).toContain('Pelagon Touchdown Site');
    });

    it('correctly models geological obstacles and high-interest anomaly targets', () => {
      const grid = generateEuropaTerrainGrid();

      // Crevasse at [2, 7]
      const crevasse = getTerrainCell(grid, 2, 7);
      expect(crevasse?.hasObstacle).toBe(true);
      expect(crevasse?.obstacleType).toBe('ICE_CREVASSE');

      // Serac pinnacle at [7, 3]
      const pinnacle = getTerrainCell(grid, 7, 3);
      expect(pinnacle?.hasObstacle).toBe(true);
      expect(pinnacle?.obstacleType).toBe('SERAC_PINNACLE');

      // Thermal vent anomaly at [6, 7]
      const anomaly = getTerrainCell(grid, 6, 7);
      expect(anomaly?.isAnomalyTarget).toBe(true);
      expect(anomaly?.scienceInterestValue).toBe(100);
      expect(anomaly?.featureName).toContain('Cryo-Thermal Vent');
    });

    it('returns undefined for out-of-bounds coordinates', () => {
      const grid = generateEuropaTerrainGrid();
      expect(getTerrainCell(grid, -1, 4)).toBeUndefined();
      expect(getTerrainCell(grid, 10, 4)).toBeUndefined();
      expect(getTerrainCell(grid, 4, 15)).toBeUndefined();
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 3. Rover Systems, Power & Thermal Dynamics                               */
  /* ------------------------------------------------------------------------ */
  describe('Rover Systems, Power & Thermal Dynamics', () => {
    it('initializes rover in STOWED status with full battery energy and nominal temperature', () => {
      const rover = createInitialRoverState();
      expect(rover.deploymentState).toBe('STOWED');
      expect(rover.mobilityState).toBe('STOWED');
      expect(rover.currentCoords).toEqual([4, 4]);
      expect(rover.batteryEnergyJoules).toBeGreaterThan(0);
      expect(rover.batteryEnergyJoules).toBeLessThanOrEqual(ROVER_BATTERY_CAPACITY_JOULES);
      expect(rover.internalTemperatureKelvin).toBeCloseTo(288.15, 1);
      expect(rover.mobilityHealthPercent).toBe(100.0);
      expect(rover.instruments.length).toBe(4);
    });

    it('switches operating modes and updates power draw', () => {
      const initial = createInitialRoverState();
      const traverseMode = setRoverOperatingMode(initial, 'TRAVERSE');
      expect(traverseMode.operatingMode).toBe('TRAVERSE');
      expect(traverseMode.powerConsumptionWatts).toBe(ROVER_POWER_DEMANDS_WATTS.TRAVERSE);

      const scienceMode = setRoverOperatingMode(traverseMode, 'SCIENCE');
      expect(scienceMode.operatingMode).toBe('SCIENCE');
      expect(scienceMode.powerConsumptionWatts).toBe(ROVER_POWER_DEMANDS_WATTS.SCIENCE);
    });

    it('ensures battery energy cannot become negative under high power drain', () => {
      const initial = createInitialRoverState();
      // Starve battery: set low energy and high drain mode
      const lowBattery = {
        ...initial,
        batteryEnergyJoules: 100,
        operatingMode: 'TRAVERSE' as const,
        powerConsumptionWatts: 95.0,
      };

      // Advance by 1 hour (3600 seconds)
      const updated = updateRoverSystems(lowBattery, 3600);
      expect(updated.batteryEnergyJoules).toBe(0);
      expect(updated.batteryEnergyJoules).not.toBeLessThan(0);
      expect(updated.operatingMode).toBe('SAFE');
      expect(updated.warningHistory.some((w) => w.includes('depleted'))).toBe(true);
    });

    it('recharges battery when RTG generation exceeds operating mode consumption', () => {
      const initial = createInitialRoverState();
      const discharged = {
        ...initial,
        batteryEnergyJoules: 1_000_000,
        operatingMode: 'SLEEP' as const, // Power demand 18W < RTG 45W -> Net +27W
        powerConsumptionWatts: ROVER_POWER_DEMANDS_WATTS.SLEEP,
      };

      const updated = updateRoverSystems(discharged, 1000); // +27,000 J
      expect(updated.batteryEnergyJoules).toBe(1_027_000);
    });

    it('accumulates ionizing radiation dose and applies consequential degradation above tolerance', () => {
      const initial = createInitialRoverState();
      const nearLimit = {
        ...initial,
        cumulativeRadiationRads: ROVER_MAX_RADIATION_TOLERANCE_RADS - 10,
      };

      // 1000 seconds adds 50 rads -> exceeds tolerance (250,040 rads)
      const updated = updateRoverSystems(nearLimit, 1000);
      expect(updated.cumulativeRadiationRads).toBeGreaterThan(ROVER_MAX_RADIATION_TOLERANCE_RADS);
      expect(updated.faultHistory.some((f) => f.includes('Radiation tolerance exceeded (250 krad)'))).toBe(true);
      expect(updated.instruments.some((inst) => inst.status === 'DEGRADED')).toBe(true);
      expect(updated.mobilityHealthPercent).toBeLessThanOrEqual(75.0);

      // Severe radiation dose (>= 350 krad): disables rover and locks to SAFE
      const severeDose = {
        ...initial,
        cumulativeRadiationRads: 350_000,
      };
      const severeUpdate = updateRoverSystems(severeDose, 100);
      expect(severeUpdate.faultHistory.some((f) => f.includes('Critical radiation threshold exceeded (350 krad)'))).toBe(true);
      expect(severeUpdate.operatingMode).toBe('SAFE');
      expect(severeUpdate.mobilityState).toBe('DISABLED');
      expect(severeUpdate.mobilityHealthPercent).toBe(0.0);
      expect(severeUpdate.instruments.every((i) => i.status === 'FAULT')).toBe(true);
    });

    it('issues warning when internal temperature drops below safe operating limit', () => {
      const initial = createInitialRoverState();
      const coldRover = {
        ...initial,
        internalTemperatureKelvin: ROVER_SAFE_TEMP_MIN_KELVIN - 5.0, // Cold soak
      };

      const updated = updateRoverSystems(coldRover, 10);
      expect(updated.warningHistory.some((w) => w.includes('sub-zero thermal violation'))).toBe(true);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 4. Traverse Validation & Kinematics                                      */
  /* ------------------------------------------------------------------------ */
  describe('Traverse Validation & Kinematics', () => {
    it('validates feasible step to an adjacent clear cell', () => {
      const grid = generateEuropaTerrainGrid();
      const rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
      };

      const validation = validateMoveFeasibility(grid, rover, [4, 5]); // 1 step south
      expect(validation.isFeasible).toBe(true);
      expect(validation.distanceMetres).toBe(20.0);
      expect(validation.energyCostJoules).toBeGreaterThan(0);
      expect(validation.durationSeconds).toBeGreaterThan(0);
    });

    it('rejects traverse when rover is STOWED aboard lander', () => {
      const grid = generateEuropaTerrainGrid();
      const stowed = createInitialRoverState();
      const validation = validateMoveFeasibility(grid, stowed, [4, 5]);

      expect(validation.isFeasible).toBe(false);
      expect(validation.reason).toContain('STOWED');
    });

    it('rejects traverse to non-adjacent cell (teleportation prevention)', () => {
      const grid = generateEuropaTerrainGrid();
      const rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
      };

      // [4, 4] -> [4, 7] is 3 cells away
      const validation = validateMoveFeasibility(grid, rover, [4, 7]);
      expect(validation.isFeasible).toBe(false);
      expect(validation.reason).toContain('not adjacent');
    });

    it('rejects traverse to a cell with an impassable physical obstacle', () => {
      const grid = generateEuropaTerrainGrid();
      // Move rover adjacent to crevasse at [2, 7], e.g. at [2, 6]
      const rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
        currentCoords: [2, 6] as [number, number],
      };

      const validation = validateMoveFeasibility(grid, rover, [2, 7]);
      expect(validation.isFeasible).toBe(false);
      expect(validation.reason).toContain('impassable obstacle');
    });

    it('rejects traverse when battery energy is insufficient', () => {
      const grid = generateEuropaTerrainGrid();
      const rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
        batteryEnergyJoules: 50, // Insufficient for 20m drive (~38 kJ)
      };

      const validation = validateMoveFeasibility(grid, rover, [4, 5]);
      expect(validation.isFeasible).toBe(false);
      expect(validation.reason).toContain('Insufficient battery energy');
    });

    it('rejects traverse when mobility health is degraded below critical limit', () => {
      const grid = generateEuropaTerrainGrid();
      const rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
        mobilityHealthPercent: 10.0, // Below 15% minimum
      };

      const validation = validateMoveFeasibility(grid, rover, [4, 5]);
      expect(validation.isFeasible).toBe(false);
      expect(validation.reason).toContain('Mobility health');
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 5. Movement Execution & Non-Mutation on Failure                          */
  /* ------------------------------------------------------------------------ */
  describe('Movement Execution & Failure Safety', () => {
    it('executes valid traverse: updates coordinates, distance, heading, and consumes energy', () => {
      const grid = generateEuropaTerrainGrid();
      const rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
        currentCoords: [4, 4] as [number, number],
        batteryEnergyJoules: 2_000_000,
        distanceTraveledMetres: 0,
      };

      // Move east to [5, 4]
      const result = executeRoverTraverse(grid, rover, [5, 4]);

      expect(result.success).toBe(true);
      expect(result.updatedRover.currentCoords).toEqual([5, 4]);
      expect(result.updatedRover.distanceTraveledMetres).toBe(20.0);
      expect(result.updatedRover.headingDeg).toBe(90); // East
      expect(result.updatedRover.batteryEnergyJoules).toBeLessThan(2_000_000);
      expect(result.energyBurnedJoules).toBeGreaterThan(0);
    });

    it('guarantees ZERO state mutation when traverse fails', () => {
      const grid = generateEuropaTerrainGrid();
      const rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
        currentCoords: [4, 4] as [number, number],
        batteryEnergyJoules: 2_000_000,
        distanceTraveledMetres: 15.0,
        headingDeg: 180,
      };

      // Attempt invalid jump to [8, 8]
      const result = executeRoverTraverse(grid, rover, [8, 8]);

      expect(result.success).toBe(false);
      expect(result.energyBurnedJoules).toBe(0);
      expect(result.distanceTraveledMetres).toBe(0);

      // Verify rover state is strictly identical to before
      expect(result.updatedRover.currentCoords).toEqual([4, 4]);
      expect(result.updatedRover.batteryEnergyJoules).toBe(2_000_000);
      expect(result.updatedRover.distanceTraveledMetres).toBe(15.0);
      expect(result.updatedRover.headingDeg).toBe(180);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 6. Surface Science Payload Acquisition                                   */
  /* ------------------------------------------------------------------------ */
  describe('Surface Science Payload Acquisition', () => {
    it('executes cryogenic drill sample: generates observation, Level 0 product, and consumes energy', () => {
      const grid = generateEuropaTerrainGrid();
      const rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
        batteryEnergyJoules: 2_000_000,
      };

      const result = executeSurfaceScienceAcquisition(grid, rover, 'CRYO_DRILL', 100_000);

      expect(result.success).toBe(true);
      expect(result.observation).toBeDefined();
      expect(result.observation?.instrumentId).toBe('CRYO_DRILL');
      expect(result.observation?.provenanceTag).toBe('FICTIONAL');
      expect(result.observation?.summary).toContain('Cryogenic core drill sample');

      // Check Level 0 product
      expect(result.level0Product).toBeDefined();
      expect(result.level0Product?.instrument).toBe('CRYO_DRILL');
      expect(result.level0Product?.status).toBe('VALIDATED');

      // Check resource consumption
      expect(result.energyConsumedJoules).toBe(45.0 * 120); // 5400 J
      expect(result.updatedRover.batteryEnergyJoules).toBe(2_000_000 - 5400);
      expect(result.updatedRover.onboardStorageUsedBytes).toBe(25_000_000);
      expect(result.updatedRover.observations.length).toBe(1);
    });

    it('rejects science acquisition when rover is in motion', () => {
      const grid = generateEuropaTerrainGrid();
      const movingRover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'MOVING' as const,
      };

      const result = executeSurfaceScienceAcquisition(grid, movingRover, 'SURFACE_CAM', 100_000);
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain('currently moving');
      expect(result.energyConsumedJoules).toBe(0);
      expect(result.updatedRover.observations.length).toBe(0);
    });

    it('rejects science acquisition when instrument is in FAULT status', () => {
      const grid = generateEuropaTerrainGrid();
      const rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
        instruments: createInitialRoverState().instruments.map((i) =>
          i.id === 'MICRO_SEISMIC' ? { ...i, status: 'FAULT' as const } : i
        ),
      };

      const result = executeSurfaceScienceAcquisition(grid, rover, 'MICRO_SEISMIC', 100_000);
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain('status is FAULT');
      expect(result.energyConsumedJoules).toBe(0);
    });

    it('rejects science acquisition when onboard storage is exhausted', () => {
      const grid = generateEuropaTerrainGrid();
      const rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
        onboardStorageUsedBytes: 495_000_000, // Only 5 MB free, Camera needs 45 MB
        onboardStorageCapacityBytes: 500_000_000,
      };

      const result = executeSurfaceScienceAcquisition(grid, rover, 'SURFACE_CAM', 100_000);
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain('storage full');
      expect(result.updatedRover.observations.length).toBe(0);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 7. Orbital Parking Prerequisite & Deployment Gating                     */
  /* ------------------------------------------------------------------------ */
  describe('Orbital Parking Prerequisite & Deployment Gating', () => {
    it('blocks rover deployment if 100 km parking orbit prerequisite is unacknowledged', () => {
      const manager = new SurfaceMissionManager();
      // By default in Phase 6.6.1, prerequisite starts FALSE

      const result = manager.deploySurfaceRover(100_000);
      expect(result.success).toBe(false);
      expect(result.message).toContain('parking-orbit prerequisite unacknowledged');
      expect(manager.getRoverState().deploymentState).toBe('STOWED');
    });

    it('deploys rover successfully when prerequisite is met and initializes directives', () => {
      const manager = new SurfaceMissionManager();
      const auth = manager.authorizeParkingOrbitPrerequisite(100_000);
      expect(auth.success).toBe(true);

      const result = manager.deploySurfaceRover(100_000);

      expect(result.success).toBe(true);
      expect(manager.getRoverState().deploymentState).toBe('DEPLOYED');
      expect(manager.getRoverState().mobilityState).toBe('READY');

      // Deployment objective completed
      const snapshot = manager.getSnapshot();
      const deployObj = snapshot.objectives.find((o) => o.id === 'obj-rover-deploy');
      expect(deployObj?.isCompleted).toBe(true);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 8. Phase 6.6.2 Hardening: Idempotent Radiation Degradation (MAJ-01)      */
  /* ------------------------------------------------------------------------ */
  describe('Phase 6.6.2: Idempotent Radiation Degradation (MAJ-01)', () => {
    it('initializes rover with NOMINAL radiation tier', () => {
      const rover = createInitialRoverState();
      expect(rover.radiationTier).toBe('NOMINAL');
    });

    it('degrades exactly one instrument when crossing 250 krad and remains idempotent on subsequent ticks', () => {
      let rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        operatingMode: 'IDLE' as const,
        cumulativeRadiationRads: 249_000,
        radiationTier: 'NOMINAL' as const,
      };

      const nominalInstrumentsBefore = rover.instruments.filter((i) => i.status === 'NOMINAL').length;

      // Tick 1: Cross 250 krad (251 krad)
      rover = { ...rover, cumulativeRadiationRads: 251_000 };
      rover = updateRoverSystems(rover, 10, 1000);

      expect(rover.radiationTier).toBe('DEGRADED_250K');
      expect(rover.mobilityHealthPercent).toBe(75.0);
      const nominalInstrumentsAfterTick1 = rover.instruments.filter((i) => i.status === 'NOMINAL').length;
      expect(nominalInstrumentsAfterTick1).toBe(nominalInstrumentsBefore - 1);
      expect(rover.instruments.some((i) => i.status === 'DEGRADED')).toBe(true);

      // Ticks 2 through 10: Repeated ticks at >250 krad (e.g. 260 krad)
      for (let tick = 0; tick < 10; tick++) {
        rover = { ...rover, cumulativeRadiationRads: 260_000 + tick * 1000 };
        rover = updateRoverSystems(rover, 10, 1010 + tick * 10);

        // Invariant: no further instruments are degraded, tier remains DEGRADED_250K, mobility capped at 75%
        expect(rover.radiationTier).toBe('DEGRADED_250K');
        expect(rover.mobilityHealthPercent).toBe(75.0);
        const nominalCount = rover.instruments.filter((i) => i.status === 'NOMINAL').length;
        expect(nominalCount).toBe(nominalInstrumentsAfterTick1);
      }
    });

    it('transitions to CRITICAL_350K, enters SAFE mode, and disables mobility upon crossing 350 krad', () => {
      let rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
        operatingMode: 'IDLE' as const,
        cumulativeRadiationRads: 349_000,
        radiationTier: 'DEGRADED_250K' as const,
        mobilityHealthPercent: 75.0,
      };

      // Cross 350 krad
      rover = { ...rover, cumulativeRadiationRads: 351_000 };
      rover = updateRoverSystems(rover, 10, 2000);

      expect(rover.radiationTier).toBe('CRITICAL_350K');
      expect(rover.operatingMode).toBe('SAFE');
      expect(rover.mobilityState).toBe('DISABLED');
      expect(rover.mobilityHealthPercent).toBe(0.0);

      // Subsequent ticks stay locked in CRITICAL_350K / SAFE
      rover = updateRoverSystems(rover, 10, 2010);
      expect(rover.radiationTier).toBe('CRITICAL_350K');
      expect(rover.operatingMode).toBe('SAFE');
      expect(rover.mobilityState).toBe('DISABLED');
    });

    it('deterministically handles large time steps jumping from NOMINAL to >350 krad in a single step', () => {
      let rover = {
        ...createInitialRoverState(),
        deploymentState: 'DEPLOYED' as const,
        mobilityState: 'READY' as const,
        operatingMode: 'IDLE' as const,
        cumulativeRadiationRads: 0,
        radiationTier: 'NOMINAL' as const,
      };

      // Jump straight to 360 krad
      rover = { ...rover, cumulativeRadiationRads: 360_000 };
      rover = updateRoverSystems(rover, 1000, 5000);

      expect(rover.radiationTier).toBe('CRITICAL_350K');
      expect(rover.operatingMode).toBe('SAFE');
      expect(rover.mobilityState).toBe('DISABLED');
      expect(rover.mobilityHealthPercent).toBe(0.0);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 9. Phase 6.6.2 Hardening: Atomic Batch Storage & Rollback (CRIT-02)      */
  /* ------------------------------------------------------------------------ */
  describe('Phase 6.6.2: Atomic Batch Storage & Rollback (CRIT-02)', () => {
    it('commits full batch when storage capacity and IDs are valid', () => {
      const storage = new OnboardStorage(10_000);
      const packets = [
        { id: 'pkt-batch-01', category: 'science' as const, sizeBytes: 1000, createdAtMETSeconds: 10 },
        { id: 'pkt-batch-02', category: 'science' as const, sizeBytes: 2000, createdAtMETSeconds: 10 },
      ];

      const res = storage.storeDataBatch(packets);
      expect(res.length).toBe(2);
      expect(storage.getUsedStorageBytes()).toBe(3000);
      expect(storage.getPacket('pkt-batch-01')).toBeDefined();
      expect(storage.getPacket('pkt-batch-02')).toBeDefined();
    });

    it('atomically rejects and rolls back if batch exceeds available capacity', () => {
      const storage = new OnboardStorage(3000);
      // Pre-fill 1000 bytes
      storage.storeData({ id: 'pkt-existing', category: 'engineering', sizeBytes: 1000, createdAtMETSeconds: 5 });

      const packets = [
        { id: 'pkt-batch-01', category: 'science' as const, sizeBytes: 1000, createdAtMETSeconds: 10 },
        { id: 'pkt-batch-02', category: 'science' as const, sizeBytes: 1500, createdAtMETSeconds: 10 }, // Total batch 2500, free is 2000
      ];

      expect(() => storage.storeDataBatch(packets)).toThrow(/exceeds available storage/i);
      // Verify storage was not mutated: still only 1000 bytes
      expect(storage.getUsedStorageBytes()).toBe(1000);
      expect(storage.getPacket('pkt-batch-01')).toBeUndefined();
      expect(storage.getPacket('pkt-batch-02')).toBeUndefined();
    });

    it('atomically rejects if duplicate packet ID is detected within batch or in storage', () => {
      const storage = new OnboardStorage(10_000);
      storage.storeData({ id: 'pkt-existing', category: 'engineering', sizeBytes: 1000, createdAtMETSeconds: 5 });

      // Duplicate with existing
      const packetsColliding = [
        { id: 'pkt-batch-01', category: 'science' as const, sizeBytes: 500, createdAtMETSeconds: 10 },
        { id: 'pkt-existing', category: 'science' as const, sizeBytes: 500, createdAtMETSeconds: 10 },
      ];

      expect(() => storage.storeDataBatch(packetsColliding)).toThrow(/Duplicate packet ID/i);
      expect(storage.getUsedStorageBytes()).toBe(1000);
      expect(storage.getPacket('pkt-batch-01')).toBeUndefined();

      // Duplicate within batch itself
      const packetsInternalDup = [
        { id: 'pkt-batch-dup', category: 'science' as const, sizeBytes: 500, createdAtMETSeconds: 10 },
        { id: 'pkt-batch-dup', category: 'science' as const, sizeBytes: 500, createdAtMETSeconds: 10 },
      ];

      expect(() => storage.storeDataBatch(packetsInternalDup)).toThrow(/Duplicate packet ID/i);
      expect(storage.getUsedStorageBytes()).toBe(1000);
    });
  });
});
