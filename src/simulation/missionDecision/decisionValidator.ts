/**
 * SECTOR 17 — Decision Validator
 * Validates candidate mission options against flight software state machines,
 * engineering resource completeness, physical margins, and objective prerequisites.
 *
 * SAFETY INVARIANTS:
 * 1. Missing resource measurement is strictly distinguished from a resource shortage:
 *    missing telemetry yields INCOMPLETE, NEVER FEASIBLE.
 * 2. Critical safety restrictions (active faults, SAFE_MODE) can NEVER be overridden
 *    by high scientific return scores.
 * 3. Expired options are strictly flagged as EXPIRED.
 */

import type { DecisionOption, DecisionValidationResult, SpacecraftEngineeringSnapshot } from './types';
import type { MissionObjectiveEvaluator } from './missionObjectiveEvaluator';

export class DecisionValidator {
  /**
   * Validates a candidate decision option against engineering state, evidence, and prerequisites.
   */
  public validate(
    option: DecisionOption,
    snapshot: SpacecraftEngineeringSnapshot | undefined,
    objectiveEvaluator: MissionObjectiveEvaluator,
    currentMET: number
  ): DecisionValidationResult {
    const reasons: string[] = [];
    const missingResourceMetrics: string[] = [];
    const constraintViolations: string[] = [];

    // 1. Expiration Gate
    if (option.expirationMET !== undefined && currentMET > option.expirationMET) {
      reasons.push(
        `Decision option expired at MET ${option.expirationMET} s (Current MET: ${currentMET} s).`
      );
      return {
        status: 'EXPIRED',
        reasons,
        missingResourceMetrics,
        constraintViolations,
        validatedAtMET: currentMET,
      };
    }

    // 2. Telemetry Completeness Gate (Distinguishes missing measurement from shortage)
    if (!snapshot) {
      missingResourceMetrics.push('spacecraftEngineeringSnapshot');
    } else {
      if (
        option.resourceRequirements.estimatedPowerWatts !== undefined &&
        option.resourceRequirements.estimatedPowerWatts > 0 &&
        snapshot.powerBudget === undefined
      ) {
        missingResourceMetrics.push('powerBudget');
      }

      if (
        option.resourceRequirements.estimatedPropellantKg !== undefined &&
        option.resourceRequirements.estimatedPropellantKg > 0 &&
        snapshot.availablePropellantKg === undefined
      ) {
        missingResourceMetrics.push('availablePropellantKg');
      }

      if (
        option.resourceRequirements.estimatedStorageBytes !== undefined &&
        option.resourceRequirements.estimatedStorageBytes > 0 &&
        (snapshot.storageCapacityBytes === undefined || snapshot.storageUsedBytes === undefined)
      ) {
        missingResourceMetrics.push('onboardStorageStatus');
      }
    }

    if (missingResourceMetrics.length > 0) {
      reasons.push(
        `Decision cannot be validated as FEASIBLE due to missing engineering telemetry: ${missingResourceMetrics.join(
          ', '
        )}.`
      );
      return {
        status: 'INCOMPLETE',
        reasons,
        missingResourceMetrics,
        constraintViolations,
        validatedAtMET: currentMET,
      };
    }

    // Safe to assert snapshot is defined from here onward
    const snap = snapshot!;

    // 3. Objective Prerequisites Gate
    if (option.prerequisites && option.prerequisites.length > 0) {
      for (const prereqId of option.prerequisites) {
        const prereq = objectiveEvaluator.getObjective(prereqId);
        if (!prereq || prereq.state !== 'COMPLETED') {
          constraintViolations.push(
            `Prerequisite mission objective '${prereqId}' is not COMPLETED (Current state: ${
              prereq ? prereq.state : 'NOT_FOUND'
            }).`
          );
        }
      }
    }

    // 4. Hard Safety Constraint & Flight State Gate
    // Safety cannot be overridden by scientific value!
    if (option.riskAssessment.hasHardConstraintViolation) {
      constraintViolations.push(
        'Hard aerospace safety constraint violated: active critical faults or restricted flight state.'
      );
    }

    if (option.category === 'LAUNCH_AUTHORIZATION') {
      if (snap.readinessCertified !== true) {
        constraintViolations.push('Mission flight readiness certification has not been certified.');
      }
      if (snap.engineeringValidationStatus === 'FAIL') {
        constraintViolations.push('Spacecraft engineering architecture validation in FAIL status.');
      }
      if (snap.engineeringValidationStatus === 'INCOMPLETE') {
        constraintViolations.push('Spacecraft engineering architecture validation is INCOMPLETE. Required subsystems missing.');
      }
      if (!snap.engineeringValidationStatus) {
        constraintViolations.push('Spacecraft engineering architecture validation report is missing.');
      }
      if (snap.criticalFaultCount > 0) {
        constraintViolations.push(`Active critical faults present (${snap.criticalFaultCount}). Launch prohibited.`);
      }
      if (snap.campaignStageId && snap.campaignStageId !== 'LAUNCH_AUTHORIZATION' && snap.campaignStageId !== 'MISSION_READINESS') {
        constraintViolations.push(`Launch authorization cannot be granted in campaign stage '${snap.campaignStageId}'. Expected 'LAUNCH_AUTHORIZATION'.`);
      }
    }

    if (option.category === 'DEPLOY_LANDER') {
      const isLanderStage =
        snap.campaignStageId === 'SURFACE_MISSION_PREPARATION' ||
        snap.campaignStageId === 'LANDER_DEPLOYMENT' ||
        snap.campaignStageId === 'EUROPA_RECONNAISSANCE';
      const isLanderPhase =
        snap.navigationPhase === 'EUROPA_RECONNAISSANCE' ||
        snap.navigationPhase === 'SURFACE_OPERATIONS';

      if (snap.campaignStageId && !isLanderStage) {
        constraintViolations.push(
          `Surface lander descent cannot be authorized in campaign stage '${snap.campaignStageId}'. Requires Europa reconnaissance.`
        );
      } else if (!snap.campaignStageId && snap.navigationPhase && !isLanderPhase) {
        constraintViolations.push(
          `Surface lander descent cannot be authorized in navigation phase '${snap.navigationPhase}'. Requires Europa reconnaissance.`
        );
      }
    }

    if (option.category === 'CONTINUE_INVESTIGATION' || option.category === 'PRIORITIZE_ANOMALY') {
      const isPrelaunchStage =
        snap.campaignStageId === 'SPACECRAFT_DESIGN' ||
        snap.campaignStageId === 'MISSION_READINESS' ||
        snap.campaignStageId === 'LAUNCH_AUTHORIZATION';

      if (isPrelaunchStage) {
        constraintViolations.push(
          `Science investigation operations cannot be authorized prior to orbital launch (Current stage: ${snap.campaignStageId}).`
        );
      }
    }

    if (
      (snap.flightState === 'SAFE_MODE' || snap.flightState === 'PRELAUNCH_HOLD') &&
      option.category !== 'ABORT_OR_SUSPEND'
    ) {
      constraintViolations.push(
        `Spacecraft is in ${snap.flightState}. Flight software disallows commanding '${option.category}'.`
      );
    }

    // 5. Subsystem Availability Gate
    if (option.resourceRequirements.requiredSubsystems) {
      for (const subsys of option.resourceRequirements.requiredSubsystems) {
        const subStatus = snap.subsystemStatuses[subsys];
        if (subStatus === 'FAULT' || subStatus === 'OFF') {
          constraintViolations.push(
            `Required subsystem '${subsys}' is in non-operational state '${subStatus ?? 'UNKNOWN'}'.`
          );
        }
      }
    }

    // 6. Resource Shortage Gate
    if (
      option.resourceRequirements.estimatedPropellantKg !== undefined &&
      snap.availablePropellantKg !== undefined &&
      snap.availablePropellantKg < option.resourceRequirements.estimatedPropellantKg
    ) {
      constraintViolations.push(
        `Propellant shortage: Requires ${option.resourceRequirements.estimatedPropellantKg.toFixed(
          1
        )} kg, but only ${snap.availablePropellantKg.toFixed(1)} kg available.`
      );
    }

    if (
      option.resourceRequirements.estimatedStorageBytes !== undefined &&
      snap.storageCapacityBytes !== undefined &&
      snap.storageUsedBytes !== undefined
    ) {
      const freeBytes = Math.max(0, snap.storageCapacityBytes - snap.storageUsedBytes);
      if (freeBytes < option.resourceRequirements.estimatedStorageBytes) {
        constraintViolations.push(
          `Storage shortage: Requires ${option.resourceRequirements.estimatedStorageBytes} bytes, but only ${freeBytes} bytes free.`
        );
      }
    }

    if (option.resourceRequirements.requiresActiveCommWindow && snap.isCommWindowActive === false) {
      constraintViolations.push('Immediate transmission requested but no active Deep Space Network pass.');
    }

    // Determine Feasibility Status
    if (constraintViolations.length > 0) {
      reasons.push(`Decision is INFEASIBLE: ${constraintViolations.join('; ')}`);
      return {
        status: 'INFEASIBLE',
        reasons,
        missingResourceMetrics,
        constraintViolations,
        validatedAtMET: currentMET,
      };
    }

    reasons.push('All engineering prerequisites, power margins, and safety gates are satisfied.');
    return {
      status: 'FEASIBLE',
      reasons,
      missingResourceMetrics,
      constraintViolations,
      validatedAtMET: currentMET,
    };
  }
}

