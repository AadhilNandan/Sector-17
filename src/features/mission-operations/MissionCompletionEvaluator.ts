import type { SimulationSnapshot } from '../../runtime/types';
import type { SimulationRuntime } from '../../runtime/simulationRuntime';
import type { CampaignManager } from '../../campaign/campaignManager';

export interface CompletionCriterion {
  id: string;
  label: string;
  description: string;
  met: boolean;
  isMandatory: boolean;
}

export interface MissionCompletionEvaluation {
  isEligible: boolean;
  scorePercent: number;
  status: 'IN_PROGRESS' | 'PARTIAL_READY' | 'FULL_READY' | 'COMPLETED';
  criteria: CompletionCriterion[];
  summary: string;
}

/**
 * Authoritative evaluator for Expedition-V mission completion from Mission Operations.
 * Bypasses intermediate surface/anomaly exploration routes per Phase 7.5 architectural scope.
 */
export function evaluateMissionCompletion(
  snap: SimulationSnapshot,
  _campaign?: CampaignManager | null
): MissionCompletionEvaluation {
  const isFailed = snap.campaign?.isCampaignFailed ?? false;
  const isCompleted = snap.campaign?.isCampaignCompleted ?? false;

  // Criterion 1: Spacecraft Health
  const spacecraftHealthy =
    !isFailed &&
    (snap.flightState as string) !== 'CRITICAL_FAULT' &&
    snap.subsystems?.EPS !== 'FAULT' &&
    snap.subsystems?.TCS !== 'FAULT';

  // Criterion 2: Trajectory & Orbit
  const trajectoryAchieved =
    (snap.navigation?.executedManeuvers && snap.navigation.executedManeuvers.length > 0) ||
    (snap.flightState as string) === 'IN_ORBIT' ||
    snap.flightState === 'ACTIVE' ||
    (snap.campaign?.currentStageId &&
      ['INTERPLANETARY_CRUISE', 'JUPITER_ARRIVAL', 'EUROPA_RECONNAISSANCE', 'MISSION_DEBRIEF'].includes(
        snap.campaign.currentStageId
      ));

  // Criterion 3: Power & Thermal Stability
  const powerThermalStable =
    (snap.powerBudget?.powerReservePercent ?? 85) > 15 &&
    (snap.powerBudget?.netPowerWatts ?? 0) >= -150;

  // Criterion 4: Science Data Processing
  const hasScienceData =
    (snap.scienceProducts?.totalCount ?? 0) > 0 ||
    (snap.storage?.usedBytes ?? 0) > 0 ||
    snap.objectives.some((o) => o.isCompleted || (o as any).progress > 0) ||
    (snap.recentEvents &&
      snap.recentEvents.some(
        (e) =>
          typeof (e as any).eventType === 'string' &&
          ((e as any).eventType.includes('SCIENCE') || (e as any).eventType.includes('RECON'))
      ));

  // Criterion 5: Ground Operations Deployment (Operational event within Mission Ops)
  const landerDeployed =
    (snap.recentEvents &&
      snap.recentEvents.some(
        (e) =>
          typeof (e as any).eventType === 'string' &&
          ((e as any).eventType.includes('LANDER') ||
            (e as any).eventType.includes('DROP') ||
            (e as any).eventType.includes('PROMETHEUS'))
      )) ||
    (snap.campaign?.completedStageIds &&
      snap.campaign.completedStageIds.includes('LANDER_DEPLOYMENT'));

  const criteria: CompletionCriterion[] = [
    {
      id: 'crit-spacecraft',
      label: 'Spacecraft Structural & Subsystem Integrity',
      description: 'Vehicle bus, power distribution, and thermal loops operating within flight envelopes.',
      met: spacecraftHealthy,
      isMandatory: true,
    },
    {
      id: 'crit-trajectory',
      label: 'Jovian Orbit & Trajectory Verification',
      description: 'Arrival trajectory and Jovian orbital parameters verified nominal.',
      met: Boolean(trajectoryAchieved),
      isMandatory: true,
    },
    {
      id: 'crit-power-thermal',
      label: 'Power & Thermal Margin Adequacy',
      description: 'Solar arrays or RTG meeting primary payload loads with positive or stable battery reserve.',
      met: powerThermalStable,
      isMandatory: false,
    },
    {
      id: 'crit-science',
      label: 'Scientific Observation & Data Acquisition',
      description: 'Primary sensor packets collected and queued on onboard solid-state storage.',
      met: hasScienceData,
      isMandatory: false,
    },
    {
      id: 'crit-ground-event',
      label: 'PROMETHEUS-IV Subsurface Probe Deployment',
      description: 'Ground survey probe released via operational flight control sequence.',
      met: Boolean(landerDeployed),
      isMandatory: false,
    },
  ];

  const mandatoryMet = criteria.filter((c) => c.isMandatory).every((c) => c.met);
  const totalMet = criteria.filter((c) => c.met).length;
  const scorePercent = Math.round((totalMet / criteria.length) * 100);

  let status: MissionCompletionEvaluation['status'] = 'IN_PROGRESS';
  if (isCompleted || snap.campaign?.currentStageId === 'MISSION_DEBRIEF') {
    status = 'COMPLETED';
  } else if (mandatoryMet && totalMet >= 3) {
    status = 'FULL_READY';
  } else if (mandatoryMet && totalMet >= 2) {
    status = 'PARTIAL_READY';
  }

  const isEligible = !isFailed && mandatoryMet && (status === 'FULL_READY' || status === 'PARTIAL_READY' || status === 'COMPLETED');

  let summary = 'AETHON conducting nominal flight operations. Complete required science and deployment to finalize expedition.';
  if (isCompleted) {
    summary = 'Expedition-V operations concluded. Performance records ready for archival review in Mission Debrief.';
  } else if (status === 'FULL_READY') {
    summary = 'All primary mission directives satisfied. Ready to conclude expedition and proceed to Mission Debrief.';
  } else if (status === 'PARTIAL_READY') {
    summary = 'Core directives satisfied with partial payload returns. Mission may be concluded or further observations conducted.';
  } else if (isFailed) {
    summary = 'Critical vehicle or trajectory anomaly. Expedition cannot proceed nominal.';
  }

  return {
    isEligible,
    scorePercent,
    status,
    criteria,
    summary,
  };
}

/**
 * Concludes flight operations and transitions campaign state directly to MISSION_DEBRIEF.
 */
export async function finalizeMissionToDebrief(
  runtime: SimulationRuntime,
  campaign?: CampaignManager | null
): Promise<{ success: boolean; message: string }> {
  try {
    const met = runtime.getFlightComputer?.()?.getCurrentMETSeconds?.() ?? 0;

    // 1. Dispatch operational completion event
    try {
      runtime.getEventEngine()?.emitImmediateEvent({
        id: `evt-debrief-${Date.now()}`,
        type: 'MISSION_DEBRIEF_ARCHIVED',
        scheduledTimeSeconds: met,
        payload: { note: 'Concluded from Mission Operations' },
      });
    } catch {
      // Non-fatal event emission
    }

    // 2. Evaluate mission outcome report
    try {
      runtime.evaluateMissionOutcome?.();
    } catch {
      // Non-fatal
    }

    // 3. Advance campaign to MISSION_DEBRIEF
    if (campaign) {
      campaign.advanceToStage('MISSION_DEBRIEF', {
        note: 'Expedition-V concluded from Mission Operations workstation.',
      });
      await campaign.save?.();
    }

    return {
      success: true,
      message: 'Expedition-V finalized successfully. Ready for Mission Debrief.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message ?? 'Failed to finalize mission.',
    };
  }
}
