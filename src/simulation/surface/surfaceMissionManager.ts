/**
 * SECTOR 17 — Surface Mission Manager (Master Orchestrator)
 * Coordinates the autonomous Europa micro-rover, terrain topology, mobility kinematics,
 * science payload operations, lander proximity relay, campaign objectives, and persistence.
 *
 * NON-NEGOTIABLE SCIENTIFIC & PREREQUISITE CONSTRAINTS:
 * 1. Enforces the 100 km Europa parking-orbit assumption prerequisite before touchdown/deployment.
 * 2. Blocks rover deployment if carrier has not achieved lander touchdown.
 * 3. Zero mutation of rover state on failed traverses or invalid instrument sampling.
 * 4. Stores surface science in onboard storage, then relays to AETHON carrier and Earth.
 */

import {
  ROVER_TO_LANDER_RELAY_BPS,
  ROVER_POWER_DEMANDS_WATTS,
  LANDER_ORBITAL_CAPTURE_ASSUMPTION_TEXT,
} from './constants';
import {
  generateEuropaTerrainGrid,
  getTerrainCell,
} from './terrainModel';
import {
  createInitialRoverState,
  updateRoverSystems,
  setRoverOperatingMode,
} from './roverSystems';
import {
  executeRoverTraverse,
  type TraverseExecutionResult,
} from './roverMobility';
import {
  executeSurfaceScienceAcquisition,
  type ScienceAcquisitionResult,
} from './surfaceScience';
import type {
  RoverState,
  RoverOperatingMode,
  SurfaceInstrumentId,
  TerrainCell,
  SurfaceObjective,
  SurfaceMissionSnapshot,
  SurfaceSerializedState,
  SurfaceRelayState,
} from './types';
import type { FlightComputer } from '../flightSoftware/flightComputer';
import type { MissionEventEngine } from '../operations/missionEventEngine';
import type { ScienceProcessingManager } from '../science/scienceProcessingManager';
import type { CommunicationManager } from '../communications/communicationManager';
import type { NavigationManager } from '../navigation/navigationManager';

export class SurfaceMissionManager {
  private isInitialized: boolean = false;
  private landingSite: string = 'Pelagon Chaos';
  private fallbackParkingOrbitPrerequisiteMet: boolean = false;
  private rover: RoverState;
  private terrainGrid: TerrainCell[][];
  private objectives: SurfaceObjective[];
  private relayState: SurfaceRelayState;
  private lastActionStatus?: { success: boolean; message: string; timestampMET: number };
  private eventCounter: number = 0;

  // External Connected Systems
  private flightComputer?: FlightComputer;
  private eventEngine?: MissionEventEngine;
  private scienceManager?: ScienceProcessingManager;
  private commManager?: CommunicationManager;
  private navManager?: NavigationManager;

  constructor() {
    this.terrainGrid = generateEuropaTerrainGrid();
    this.rover = createInitialRoverState();
    this.objectives = this.createDefaultObjectives();
    this.relayState = {
      isRelayLinkAvailable: true,
      linkBudgetMarginDb: 14.2, // Robust UHF line-of-sight proximity link to lander
      unseveredLineOfSight: true,
      pendingUploadBytes: 0,
      totalUploadedToCarrierBytes: 0,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* Dependency Hooks                                                           */
  /* -------------------------------------------------------------------------- */

  public attachFlightComputer(fc: FlightComputer): void {
    this.flightComputer = fc;
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  public attachScienceManager(sm: ScienceProcessingManager): void {
    this.scienceManager = sm;
  }

  public attachCommunicationManager(cm: CommunicationManager): void {
    this.commManager = cm;
  }

  public attachNavigationManager(nm: NavigationManager): void {
    this.navManager = nm;
  }

  /* -------------------------------------------------------------------------- */
  /* Snapshot & State Queries                                                   */
  /* -------------------------------------------------------------------------- */

  public getSnapshot(): SurfaceMissionSnapshot {
    return {
      isInitialized: this.isInitialized,
      landingSite: this.landingSite,
      parkingOrbitPrerequisiteMet: this.isParkingOrbitPrerequisiteAuthorized(),
      parkingOrbitAssumptionNotice: LANDER_ORBITAL_CAPTURE_ASSUMPTION_TEXT,
      rover: { ...this.rover },
      gridWidth: this.terrainGrid[0]?.length ?? 10,
      gridHeight: this.terrainGrid.length,
      terrainGrid: this.terrainGrid.map((row) => row.map((cell) => ({ ...cell }))),
      objectives: this.objectives.map((obj) => ({ ...obj })),
      relay: { ...this.relayState },
      lastActionStatus: this.lastActionStatus ? { ...this.lastActionStatus } : undefined,
    };
  }

  public getRoverState(): RoverState {
    return { ...this.rover };
  }

  public getTerrainGrid(): readonly (readonly TerrainCell[])[] {
    return this.terrainGrid;
  }

  /**
   * Queries whether the 100 km circular Europa parking-orbit assumption is authorized.
   * Authoritative source is NavigationManager's lander state when connected.
   */
  public isParkingOrbitPrerequisiteAuthorized(): boolean {
    if (this.navManager) {
      return this.navManager.isParkingOrbitPrerequisiteAuthorized();
    }
    return this.fallbackParkingOrbitPrerequisiteMet === true;
  }

  /* -------------------------------------------------------------------------- */
  /* Rover Deployment & Initialization                                          */
  /* -------------------------------------------------------------------------- */

  /**
   * Authorizes the 100 km Europa circular parking-orbit prerequisite for surface operations.
   * Delegates to authoritative NavigationManager when connected to ensure single-source integrity.
   */
  public authorizeParkingOrbitPrerequisite(currentMET: number): { success: boolean; message: string } {
    if (this.navManager) {
      const res = this.navManager.authorizeParkingOrbitAssumption(currentMET);
      this.lastActionStatus = { success: res.success, message: res.message, timestampMET: currentMET };
      return res;
    }

    if (this.fallbackParkingOrbitPrerequisiteMet) {
      return {
        success: true,
        message: 'Europa parking-orbit prerequisite is already authorized.',
      };
    }

    this.fallbackParkingOrbitPrerequisiteMet = true;
    this.emitEvent('PARKING_ORBIT_ASSUMPTION_AUTHORIZED', currentMET, {
      prerequisite: '100 km circular Europa parking orbit assumption acknowledged',
      targetSite: this.landingSite,
    });
    const msg = 'Europa parking-orbit prerequisite authorized for surface operations.';
    this.lastActionStatus = { success: true, message: msg, timestampMET: currentMET };
    return { success: true, message: msg };
  }

  public deploySurfaceRover(currentMET: number): { success: boolean; message: string } {
    // 1. Verify Lander Status & Parking Orbit Prerequisite (Directive Section 2.1)
    if (this.navManager) {
      const lander = this.navManager.getLanderState();
      if (lander.flightState !== 'TOUCHDOWN') {
        const msg = `Cannot deploy rover: Lander flight state is ${lander.flightState}. Soft touchdown on Europa surface is strictly required.`;
        this.lastActionStatus = { success: false, message: msg, timestampMET: currentMET };
        return { success: false, message: msg };
      }
    }

    if (!this.isParkingOrbitPrerequisiteAuthorized()) {
      const msg = 'Rover deployment inhibited: Required 100 km Europa parking-orbit prerequisite unacknowledged.';
      this.lastActionStatus = { success: false, message: msg, timestampMET: currentMET };
      return { success: false, message: msg };
    }

    if (this.rover.deploymentState !== 'STOWED') {
      const msg = `Rover is already in deployment state: ${this.rover.deploymentState}.`;
      this.lastActionStatus = { success: false, message: msg, timestampMET: currentMET };
      return { success: false, message: msg };
    }

    // 2. Transition Rover to DEPLOYED / READY
    this.isInitialized = true;
    this.rover = {
      ...this.rover,
      deploymentState: 'DEPLOYED',
      mobilityState: 'READY',
      operatingMode: 'IDLE',
      powerConsumptionWatts: ROVER_POWER_DEMANDS_WATTS.IDLE,
    };

    // 3. Mark LANDER_ROVER subsystem nominal in flight computer
    const landerSubsys = this.flightComputer?.getSubsystemManager().getSubsystem('LANDER_ROVER');
    if (landerSubsys) {
      landerSubsys.setStatus('NOMINAL');
    }

    // 4. Update Objectives
    this.completeObjective('obj-rover-deploy', currentMET);

    // 5. Emit Events
    this.emitEvent('ROVER_DEPLOYMENT_COMPLETE', currentMET, {
      roverId: this.rover.roverId,
      site: this.landingSite,
      coords: this.rover.currentCoords,
    });
    this.emitEvent('ROVER_SYSTEMS_INITIALIZED', currentMET, {
      batteryEnergyWh: (this.rover.batteryEnergyJoules / 3600).toFixed(1),
      operatingMode: this.rover.operatingMode,
    });

    const msg = `Rover ${this.rover.roverId} successfully deployed and initialized on Europa surface at ${this.landingSite}.`;
    this.lastActionStatus = { success: true, message: msg, timestampMET: currentMET };
    return { success: true, message: msg };
  }

  /* -------------------------------------------------------------------------- */
  /* Rover Mobility Operations                                                  */
  /* -------------------------------------------------------------------------- */

  public executeTraverse(
    targetX: number,
    targetY: number,
    currentMET: number
  ): TraverseExecutionResult {
    this.emitEvent('SURFACE_TRAVERSE_STARTED', currentMET, {
      fromCoords: this.rover.currentCoords,
      toCoords: [targetX, targetY],
    });

    const result = executeRoverTraverse(this.terrainGrid, this.rover, [targetX, targetY]);

    if (!result.success) {
      this.emitEvent('SURFACE_TRAVERSE_FAILED', currentMET, {
        targetCoords: [targetX, targetY],
        reason: result.failureReason,
      });

      this.lastActionStatus = {
        success: false,
        message: result.failureReason ?? 'Traverse failed.',
        timestampMET: currentMET,
      };
      return result;
    }

    // Update rover and mark surveyed cell
    this.rover = result.updatedRover;
    const targetCell = getTerrainCell(this.terrainGrid, targetX, targetY);
    if (targetCell) {
      this.terrainGrid[targetY][targetX] = {
        ...targetCell,
        isSurveyed: true,
      };

      // Check Anomaly Target Encounter
      if (targetCell.isAnomalyTarget) {
        this.completeObjective('obj-rover-anomaly', currentMET);
        this.emitEvent('ANOMALY_DETECTED', currentMET, {
          featureName: targetCell.featureName,
          coords: [targetX, targetY],
          hazardLevel: targetCell.hazardLevel,
        });
      }
    }

    // Distance objective evaluation
    if (this.rover.distanceTraveledMetres >= 50.0) {
      this.completeObjective('obj-rover-move', currentMET, this.rover.distanceTraveledMetres);
    }

    this.emitEvent('SURFACE_TRAVERSE_COMPLETED', currentMET, {
      coords: this.rover.currentCoords,
      distanceMetres: result.distanceTraveledMetres,
      energyBurnedJoules: result.energyBurnedJoules,
    });

    this.lastActionStatus = {
      success: true,
      message: `Traverse complete to [${targetX}, ${targetY}]. Distance: ${result.distanceTraveledMetres.toFixed(1)} m, Energy: ${(result.energyBurnedJoules / 3600).toFixed(1)} Wh.`,
      timestampMET: currentMET,
    };

    return result;
  }

  /* -------------------------------------------------------------------------- */
  /* Surface Science Operations                                                 */
  /* -------------------------------------------------------------------------- */

  public executeScience(
    instrumentId: SurfaceInstrumentId,
    currentMET: number
  ): ScienceAcquisitionResult {
    const result = executeSurfaceScienceAcquisition(
      this.terrainGrid,
      this.rover,
      instrumentId,
      currentMET
    );

    if (!result.success) {
      this.lastActionStatus = {
        success: false,
        message: result.failureReason ?? 'Science acquisition failed.',
        timestampMET: currentMET,
      };
      return result;
    }

    // Update state
    this.rover = result.updatedRover;
    this.relayState = {
      ...this.relayState,
      pendingUploadBytes: this.relayState.pendingUploadBytes + (result.observation?.sizeBytes ?? 0),
    };

    // Register Level 0 science product in central registry
    if (result.level0Product && this.scienceManager) {
      this.scienceManager.getDataRegistry().registerLevel0(result.level0Product);
    }

    // Objective evaluation
    if (this.rover.observations.length >= 3) {
      this.completeObjective('obj-rover-science', currentMET, this.rover.observations.length);
    }

    // Emit event
    this.emitEvent('SURFACE_OBSERVATION_ACQUIRED', currentMET, {
      observationId: result.observation?.id,
      instrumentId,
      quality: result.observation?.qualityPercent,
      sizeBytes: result.observation?.sizeBytes,
    });

    this.lastActionStatus = {
      success: true,
      message: `Science sample acquired: ${result.observation?.summary}`,
      timestampMET: currentMET,
    };

    return result;
  }

  /* -------------------------------------------------------------------------- */
  /* Surface Data Relay: Rover -> Lander Relay -> AETHON Carrier                */
  /* -------------------------------------------------------------------------- */

  public transmitDataToRelay(currentMET: number): { success: boolean; bytesUploaded: number; message: string } {
    // 1. Verify Proximity Relay Link Availability (MIN-02)
    if (!this.relayState.isRelayLinkAvailable) {
      const msg = 'Relay transmission blocked: Proximity relay link is unavailable.';
      this.lastActionStatus = { success: false, message: msg, timestampMET: currentMET };
      return { success: false, bytesUploaded: 0, message: msg };
    }

    // 2. Verify Rover Operating Mode (MAJ-02: SAFE mode cannot transmit)
    if (this.rover.operatingMode === 'SAFE') {
      const msg = 'Relay transmission blocked: Rover is currently in SAFE survival mode.';
      this.lastActionStatus = { success: false, message: msg, timestampMET: currentMET };
      return { success: false, bytesUploaded: 0, message: msg };
    }

    const pendingObservations = this.rover.observations.filter((obs) => !obs.isTransmittedToRelay);
    if (pendingObservations.length === 0) {
      const msg = 'No new science observations pending transmission.';
      this.lastActionStatus = { success: false, message: msg, timestampMET: currentMET };
      return { success: false, bytesUploaded: 0, message: msg };
    }

    const totalBytes = pendingObservations.reduce((acc, o) => acc + o.sizeBytes, 0);

    // Calculate transmission duration: t = (bytes * 8) / bit_rate
    const durationSeconds = Math.max(1, Math.round((totalBytes * 8) / ROVER_TO_LANDER_RELAY_BPS));
    const energyRequiredJoules = ROVER_POWER_DEMANDS_WATTS.COMMUNICATION * durationSeconds;

    // 3. Pre-validate Battery Energy
    if (this.rover.batteryEnergyJoules < energyRequiredJoules) {
      const msg = `Insufficient battery energy for transmission: required ${(energyRequiredJoules / 3600).toFixed(1)} Wh, available ${(this.rover.batteryEnergyJoules / 3600).toFixed(1)} Wh.`;
      this.lastActionStatus = { success: false, message: msg, timestampMET: currentMET };
      return { success: false, bytesUploaded: 0, message: msg };
    }

    // 4. Pre-validate Carrier SSDR Available Storage Capacity (MAJ-02)
    if (this.commManager) {
      const storage = this.commManager.getStorage();
      if (storage.getAvailableStorageBytes() < totalBytes) {
        const msg = `Relay transmission blocked: Carrier AETHON SSDR storage capacity exceeded (requires ${totalBytes} bytes, available ${storage.getAvailableStorageBytes()} bytes).`;
        this.lastActionStatus = { success: false, message: msg, timestampMET: currentMET };
        return { success: false, bytesUploaded: 0, message: msg };
      }
    }

    // 5. Ingest packets into carrier AETHON onboard SSDR storage (Atomic Transaction & Compensating Rollback)
    if (this.commManager) {
      const storage = this.commManager.getStorage();
      const packetsToStore = pendingObservations.map((obs) => ({
        id: obs.dataPacketId,
        category: 'science' as const,
        sizeBytes: obs.sizeBytes,
        priority: 2,
        createdAtMETSeconds: currentMET,
      }));

      try {
        if (typeof (storage as any).storeDataBatch === 'function') {
          (storage as any).storeDataBatch(packetsToStore);
        } else {
          // Compensating rollback for custom or mock storage implementations
          const insertedIds: string[] = [];
          try {
            for (const p of packetsToStore) {
              storage.storeData(p);
              insertedIds.push(p.id);
            }
          } catch (innerErr) {
            for (const id of insertedIds) {
              if (typeof storage.deletePacket === 'function') {
                storage.deletePacket(id);
              }
            }
            throw innerErr;
          }
        }
      } catch (err: any) {
        const msg = `Relay transmission failed during carrier SSDR ingest: ${err?.message ?? String(err)}`;
        this.lastActionStatus = { success: false, message: msg, timestampMET: currentMET };
        return { success: false, bytesUploaded: 0, message: msg };
      }
    }

    // 6. Only after carrier ingest succeeds, commit energy consumption and rover storage updates
    const updatedObservations = this.rover.observations.map((obs) => ({
      ...obs,
      isTransmittedToRelay: true,
    }));

    this.rover = {
      ...this.rover,
      batteryEnergyJoules: Math.max(0, this.rover.batteryEnergyJoules - energyRequiredJoules),
      observations: updatedObservations,
      onboardStorageUsedBytes: Math.max(0, this.rover.onboardStorageUsedBytes - totalBytes),
    };

    this.relayState = {
      ...this.relayState,
      pendingUploadBytes: 0,
      totalUploadedToCarrierBytes: this.relayState.totalUploadedToCarrierBytes + totalBytes,
    };

    // 7. Complete Relay Objective
    this.completeObjective('obj-rover-relay', currentMET);

    // 8. Emit Events
    this.emitEvent('SURFACE_DATA_TRANSMITTED', currentMET, {
      bytesTransmitted: totalBytes,
      packetsCount: pendingObservations.length,
      destination: 'AETHON Carrier Relay SSDR',
    });

    const msg = `Successfully relayed ${(totalBytes / 1e6).toFixed(1)} MB of surface science data to carrier AETHON memory.`;
    this.lastActionStatus = { success: true, message: msg, timestampMET: currentMET };
    return { success: true, bytesUploaded: totalBytes, message: msg };
  }

  /* -------------------------------------------------------------------------- */
  /* Operating Mode Control                                                     */
  /* -------------------------------------------------------------------------- */

  public setOperatingMode(mode: RoverOperatingMode): RoverState {
    this.rover = setRoverOperatingMode(this.rover, mode);
    return { ...this.rover };
  }

  /* -------------------------------------------------------------------------- */
  /* Simulation Time Step Propagation                                           */
  /* -------------------------------------------------------------------------- */

  public step(deltaSeconds: number, _currentMET: number): void {
    if (!this.isInitialized) return;
    this.rover = updateRoverSystems(this.rover, deltaSeconds);
  }

  /* -------------------------------------------------------------------------- */
  /* Authoritative Persistence (Export / Restore)                               */
  /* -------------------------------------------------------------------------- */

  public exportState(): SurfaceSerializedState {
    return {
      schemaVersion: 1,
      isInitialized: this.isInitialized,
      landingSite: this.landingSite,
      parkingOrbitPrerequisiteMet: this.isParkingOrbitPrerequisiteAuthorized(),
      rover: { ...this.rover },
      terrainGrid: this.terrainGrid.map((row) => row.map((cell) => ({ ...cell }))),
      objectives: this.objectives.map((obj) => ({ ...obj })),
      relay: { ...this.relayState },
    };
  }

  public restoreState(state?: SurfaceSerializedState): void {
    if (!state) return;
    this.isInitialized = state.isInitialized ?? false;
    this.landingSite = state.landingSite ?? 'Pelagon Chaos';
    this.fallbackParkingOrbitPrerequisiteMet = state.parkingOrbitPrerequisiteMet === true;
    if (state.rover) {
      let radiationTier = state.rover.radiationTier;
      const validTiers = ['NOMINAL', 'DEGRADED_250K', 'CRITICAL_350K'];
      const dose = state.rover.cumulativeRadiationRads ?? 0;
      const doseDerivedTier =
        dose >= 350_000.0
          ? 'CRITICAL_350K'
          : dose >= 250_000.0
            ? 'DEGRADED_250K'
            : 'NOMINAL';

      if (!radiationTier || !validTiers.includes(radiationTier)) {
        radiationTier = doseDerivedTier;
      } else {
        // Restored tier cannot understate implied cumulative radiation exposure
        const tierRank = (t: string) => (t === 'CRITICAL_350K' ? 2 : t === 'DEGRADED_250K' ? 1 : 0);
        if (tierRank(radiationTier) < tierRank(doseDerivedTier)) {
          radiationTier = doseDerivedTier;
        }
      }

      let restoredInstruments = state.rover.instruments ? state.rover.instruments.map((i) => ({ ...i })) : [];
      let restoredMobilityHealth = state.rover.mobilityHealthPercent ?? 100.0;
      let restoredWheelHealth = state.rover.wheelHealthPercents
        ? ([...state.rover.wheelHealthPercents] as [number, number, number, number])
        : ([100.0, 100.0, 100.0, 100.0] as [number, number, number, number]);
      let restoredMobilityState = state.rover.mobilityState ?? 'READY';
      let restoredOperatingMode = state.rover.operatingMode ?? 'IDLE';

      // Enforce physical degradation invariants corresponding to radiation dose / tier (Finding-663-03)
      if (radiationTier === 'CRITICAL_350K') {
        restoredMobilityHealth = 0.0;
        restoredWheelHealth = [0.0, 0.0, 0.0, 0.0];
        restoredMobilityState = 'DISABLED';
        restoredOperatingMode = 'SAFE';
        restoredInstruments = restoredInstruments.map((inst) => ({ ...inst, status: 'FAULT' }));
      } else if (radiationTier === 'DEGRADED_250K') {
        // Enforce 75% mobility ceiling without accidentally improving worse conditions
        restoredMobilityHealth = Math.min(restoredMobilityHealth, 75.0);
        restoredWheelHealth = restoredWheelHealth.map((w) => Math.min(w, 75.0)) as [number, number, number, number];
        // Enforce at least one degraded instrument if all were nominal
        if (restoredInstruments.length > 0 && restoredInstruments.every((inst) => inst.status === 'NOMINAL')) {
          restoredInstruments[0] = { ...restoredInstruments[0], status: 'DEGRADED' };
        }
      }

      this.rover = {
        ...state.rover,
        radiationTier: radiationTier as 'NOMINAL' | 'DEGRADED_250K' | 'CRITICAL_350K',
        mobilityHealthPercent: restoredMobilityHealth,
        wheelHealthPercents: restoredWheelHealth,
        mobilityState: restoredMobilityState,
        operatingMode: restoredOperatingMode,
        instruments: restoredInstruments,
      };
    }
    if (state.terrainGrid && state.terrainGrid.length > 0) {
      this.terrainGrid = state.terrainGrid.map((row) => row.map((cell) => ({ ...cell })));
    }
    if (state.objectives && state.objectives.length > 0) {
      this.objectives = state.objectives.map((obj) => ({ ...obj }));
    }
    if (state.relay) {
      this.relayState = { ...state.relay };
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Internal Objectives & Event Dispatch Helpers                               */
  /* -------------------------------------------------------------------------- */

  private createDefaultObjectives(): SurfaceObjective[] {
    return [
      {
        id: 'obj-rover-deploy',
        title: 'Deploy Prometheus-IV Micro-Rover',
        description: 'Separate micro-rover from lander base and initialize autonomous systems.',
        isCompleted: false,
        targetValue: 1,
        currentValue: 0,
      },
      {
        id: 'obj-rover-move',
        title: 'Traverse Europa Surface Regolith',
        description: 'Navigate Conamara / Pelagon Chaos terrain for at least 50 metres total distance.',
        isCompleted: false,
        targetValue: 50,
        currentValue: 0,
      },
      {
        id: 'obj-rover-science',
        title: 'Acquire In-Situ Cryogenic Observations',
        description: 'Perform at least 3 distinct scientific analyses using the surface instrument suite.',
        isCompleted: false,
        targetValue: 3,
        currentValue: 0,
      },
      {
        id: 'obj-rover-anomaly',
        title: 'Investigate Thermal Vent Anomaly',
        description: 'Reach coordinates [6, 7] and characterize the subsurface cryogenic vent anomaly.',
        isCompleted: false,
        targetValue: 1,
        currentValue: 0,
      },
      {
        id: 'obj-rover-relay',
        title: 'Relay Surface Data to AETHON Carrier',
        description: 'Uplink surface science datasets to carrier AETHON storage for Earth downlink.',
        isCompleted: false,
        targetValue: 1,
        currentValue: 0,
      },
    ];
  }

  private completeObjective(id: string, currentMET: number, currentValue?: number): void {
    const index = this.objectives.findIndex((o) => o.id === id);
    if (index === -1) return;

    const currentObj = this.objectives[index];
    if (currentObj.isCompleted) return;

    this.objectives[index] = {
      ...currentObj,
      isCompleted: true,
      completedAtMET: currentMET,
      currentValue: currentValue ?? currentObj.targetValue ?? 1,
    };

    this.emitEvent('SURFACE_OBJECTIVE_COMPLETED', currentMET, {
      objectiveId: id,
      title: currentObj.title,
    });
  }

  private emitEvent(type: string, metSeconds: number, payload: Record<string, unknown>): void {
    if (this.eventEngine) {
      this.eventCounter += 1;
      this.eventEngine.emitImmediateEvent({
        id: `evt-surf-${type.toLowerCase()}-${metSeconds}-${this.eventCounter}`,
        type,
        scheduledTimeSeconds: metSeconds,
        priority: 1,
        payload,
      });
    }
  }
}
