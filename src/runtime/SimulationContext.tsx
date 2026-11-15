/**
 * SECTOR 17 — Simulation React Context & Hooks
 * Connects the SimulationRuntime store to React components using useSyncExternalStore.
 * Guarantees StrictMode resilience, subscription cleanup, and referential stability.
 *
 * ENGINEERING NOTE (Audit Finding C-01):
 * In Phase 6.1, live client DOM React StrictMode lifecycle testing was not directly
 * executable in headless Node without DOM testing dependencies (@testing-library/react / jsdom).
 * The Provider architecture uses useRef + SimulationRuntime.getOrCreate() to guarantee
 * referential resilience and prevent duplicate FlightComputer instantiations across StrictMode cycles.
 */

import React, { createContext, useContext, useRef, useSyncExternalStore } from 'react';
import { SimulationRuntime } from './simulationRuntime';
import type {
  SimulationSnapshot,
  SimulationRuntimeConfig,
  RuntimeCommandInterface,
} from './types';

export const SimulationContext = createContext<SimulationRuntime | null>(null);

export interface SimulationProviderProps {
  campaignId?: string;
  config?: SimulationRuntimeConfig;
  runtime?: SimulationRuntime;
  children: React.ReactNode;
}

/**
 * Provider maintaining the authoritative SimulationRuntime instance.
 * StrictMode resilient: Repeated renders and development unmount/remount cycles
 * reuse the active campaign instance from the runtime registry without reinstantiating
 * duplicate FlightComputers.
 */
export const SimulationProvider: React.FC<SimulationProviderProps> = ({
  campaignId = 'default-campaign',
  config,
  runtime: explicitRuntime,
  children,
}) => {
  const runtimeRef = useRef<SimulationRuntime | null>(null);

  if (!runtimeRef.current) {
    if (explicitRuntime) {
      runtimeRef.current = explicitRuntime;
    } else {
      runtimeRef.current = SimulationRuntime.getOrCreate(campaignId, config);
    }
  }

  return (
    <SimulationContext.Provider value={runtimeRef.current}>
      {children}
    </SimulationContext.Provider>
  );
};

/**
 * Hook to access the authoritative SimulationRuntime command interface.
 */
export function useSimulationRuntime(): SimulationRuntime {
  const runtime = useContext(SimulationContext);
  if (!runtime) {
    throw new Error('useSimulationRuntime: Must be used within a <SimulationProvider>.');
  }
  return runtime;
}

/**
 * Hook to subscribe to authoritative simulation snapshots via useSyncExternalStore.
 * Referentially stable: Re-renders only when underlying simulation state updates.
 */
export function useSimulationSnapshot(): SimulationSnapshot;
export function useSimulationSnapshot<T>(selector: (snapshot: SimulationSnapshot) => T): T;
export function useSimulationSnapshot<T = SimulationSnapshot>(
  selector?: (snapshot: SimulationSnapshot) => T
): T {
  const runtime = useSimulationRuntime();
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    () => runtime.getSnapshot(),
    () => runtime.getSnapshot()
  );
  return selector ? selector(snapshot) : (snapshot as unknown as T);
}

/**
 * Convenience hook for simulation time control.
 */
export function useSimulationTime() {
  const runtime = useSimulationRuntime();
  const { metSeconds, formattedMET, lifecycle } = useSimulationSnapshot((s) => ({
    metSeconds: s.metSeconds,
    formattedMET: s.formattedMET,
    lifecycle: s.lifecycle,
  }));

  return {
    metSeconds,
    formattedMET,
    lifecycle,
    isRunning: lifecycle === 'RUNNING',
    isPaused: lifecycle === 'PAUSED',
    isReady: lifecycle === 'READY',
    start: (options?: Parameters<RuntimeCommandInterface['start']>[0]) => runtime.start(options),
    pause: () => runtime.pause(),
    resume: () => runtime.resume(),
    advanceTime: (seconds: number) => runtime.advanceTime(seconds),
    clearError: () => runtime.clearError(),
  };
}

/**
 * Convenience hook for mission decisions.
 */
export function useSimulationDecisions() {
  const runtime = useSimulationRuntime();
  const availableDecisions = useSimulationSnapshot((s) => s.availableDecisions);
  const decisionHistory = useSimulationSnapshot((s) => s.decisionHistory);
  const evidenceItems = useSimulationSnapshot((s) => s.evidenceItems);

  return {
    availableDecisions,
    decisionHistory,
    evidenceItems,
    evaluateDecision: (id: string) => runtime.evaluateDecision(id),
    proposeDecision: (id: string) => runtime.proposeDecision(id),
    authorizeDecision: (id: string, approved: boolean, reason?: string) =>
      runtime.authorizeDecision(id, approved, reason),
    executeDecision: (id: string) => runtime.executeDecision(id),
  };
}

/**
 * Convenience hook for campaign progression.
 */
export function useCampaign() {
  const runtime = useSimulationRuntime();
  const campaign = useSimulationSnapshot((s) => s.campaign);
  const manager = runtime.getCampaignManager();

  return {
    campaign,
    manager,
    currentStageId: campaign?.currentStageId ?? 'CAMPAIGN_INTRO',
    currentStageStatus: campaign?.currentStageStatus ?? 'ACTIVE',
    overallProgressPercent: campaign?.overallProgressPercent ?? 0,
    isCompleted: campaign?.isCampaignCompleted ?? false,
    isFailed: campaign?.isCampaignFailed ?? false,
    activeBlockers: campaign?.activeBlockers ?? [],
    advanceStage: (targetStageId?: any) => manager.advanceToStage(targetStageId),
    saveCampaign: () => manager.save(),
    loadCampaign: () => manager.load(),
    canAccessRoute: (route: string) => manager.canAccessRoute(route),
  };
}

/**
 * Convenience hook for mission navigation and orbital maneuvers.
 */
export function useNavigation() {
  const runtime = useSimulationRuntime();
  const navigation = useSimulationSnapshot((s) => s.navigation);

  return {
    navigation,
    currentPhase: navigation?.currentPhase ?? 'PRE_LAUNCH',
    currentOrbit: navigation?.currentOrbit,
    heliocentricTrajectory: navigation?.heliocentricTrajectory,
    jupiterCapture: navigation?.jupiterCapture,
    europaFlyby: navigation?.europaFlyby,
    lander: navigation?.lander,
    availableManeuvers: navigation?.availableManeuvers ?? [],
    executedManeuvers: navigation?.executedManeuvers ?? [],
    lastValidationReport: navigation?.lastValidationReport,
    validateManeuver: (id: string) => runtime.validateNavigationManeuver(id),
    executeManeuver: (id: string) => runtime.executeNavigationManeuver(id),
    executeJupiterApproach: () => runtime.executeJupiterApproach(),
    triggerReconnaissanceScan: () => runtime.triggerReconnaissanceScan(),
    completeEuropaReconnaissance: () => runtime.completeEuropaReconnaissance(),
    selectLandingSite: (site?: string) => runtime.selectLandingSite(site),
    authorizeParkingOrbitAssumption: () => runtime.authorizeParkingOrbitAssumption(),
    executeLanderDeployment: () => runtime.executeLanderDeployment(),
    executeLanderPoweredDescent: () => runtime.executeLanderPoweredDescent(),
    authorizeParkingOrbitMissionFlowBypass: () => runtime.authorizeParkingOrbitMissionFlowBypass(),
    isParkingOrbitBypassActive: navigation?.isParkingOrbitBypassActive ?? false,
  };
}

/**
 * Convenience hook for Europa surface exploration, micro-rover mobility, and science.
 */
export function useSurfaceMission() {
  const runtime = useSimulationRuntime();
  const surface = useSimulationSnapshot((s) => s.surface);
  const navigation = useSimulationSnapshot((s) => s.navigation);

  return {
    surface,
    isInitialized: surface?.isInitialized ?? false,
    landingSite: surface?.landingSite ?? 'Pelagon Chaos',
    parkingOrbitPrerequisiteMet: surface?.parkingOrbitPrerequisiteMet ?? false,
    parkingOrbitAssumptionNotice: surface?.parkingOrbitAssumptionNotice,
    rover: surface?.rover,
    terrainGrid: surface?.terrainGrid ?? [],
    objectives: surface?.objectives ?? [],
    relay: surface?.relay,
    lastActionStatus: surface?.lastActionStatus,
    landerFlightState: navigation?.lander?.flightState ?? 'STOWED',
    deployRover: () => runtime.deploySurfaceRover(),
    executeTraverse: (x: number, y: number) => runtime.executeRoverTraverse(x, y),
    executeScience: (instId: any) => runtime.executeSurfaceScience(instId),
    transmitDataToRelay: () => runtime.transmitSurfaceDataToRelay(),
    setOperatingMode: (mode: any) => runtime.setRoverOperatingMode(mode),
  };
}

/**
 * Convenience hook for deep space communications, onboard storage, and DSN downlink.
 */
export function useCommunications() {
  const runtime = useSimulationRuntime();
  const comm = useSimulationSnapshot((s) => s.communications);
  const storage = useSimulationSnapshot((s) => s.storage);

  return {
    comm,
    storage,
    queueAllStoredScienceForDownlink: () => runtime.queueAllStoredScienceForDownlink(),
    executeDsnDownlinkStep: (durationSeconds?: number) => runtime.executeDsnDownlinkStep(durationSeconds),
  };
}

/**
 * Convenience hook for mission debrief, evaluation, and anomaly decisions.
 */
export function useDebrief() {
  const runtime = useSimulationRuntime();
  const evaluation = useSimulationSnapshot((s) => s.missionEvaluation);

  return {
    evaluation,
    evaluateMissionOutcome: () => runtime.evaluateMissionOutcome(),
    archiveMissionDebrief: () => runtime.archiveMissionDebrief(),
    executeAnomalyDecision: (decision: 'analyze' | 'sample' | 'withdraw') => runtime.executeAnomalyDecision(decision),
  };
}

