/**
 * SECTOR 17 — Spacecraft Risk Assessment Engine
 * Evaluates operational candidate decisions against spacecraft safety, active faults,
 * electrical power margins, thermal operating boundaries, propellant budgets,
 * onboard storage headroom, and communications visibility.
 *
 * SAFETY INVARIANTS:
 * 1. Hard aerospace constraints (e.g., active critical faults, SAFE_MODE, power deficits,
 *    thermal breaches) can NEVER be overridden by high scientific value scores.
 * 2. Risk scores are explicitly labeled as deterministic engineering heuristics in [0.0, 100.0],
 *    never as unverified physical or Bayesian probabilities.
 */

import {
  AEROSPACE_SAFETY_THRESHOLDS,
  RISK_SEVERITY_SCORES,
} from './constants';
import type {
  RiskSeverity,
  RiskItem,
  RiskAssessmentReport,
  DecisionResourceRequirements,
  SpacecraftEngineeringSnapshot,
} from './types';

export class RiskAssessmentEngine {
  /**
   * Performs an integrated risk evaluation of candidate operational requirements
   * against the spacecraft engineering state.
   */
  public evaluateRisk(
    requirements: DecisionResourceRequirements,
    snapshot: SpacecraftEngineeringSnapshot | undefined,
    currentMET: number,
    supportingEvidenceIds: readonly string[] = []
  ): RiskAssessmentReport {
    if (typeof currentMET !== 'number' || !Number.isFinite(currentMET) || currentMET < 0) {
      throw new TypeError(`evaluateRisk: currentMET must be a non-negative finite number. Received: ${currentMET}`);
    }

    if (!requirements || typeof requirements !== 'object') {
      throw new TypeError('evaluateRisk: requirements must be an object.');
    }

    if (requirements.estimatedPropellantKg !== undefined) {
      if (typeof requirements.estimatedPropellantKg !== 'number' || !Number.isFinite(requirements.estimatedPropellantKg)) {
        throw new TypeError(
          `evaluateRisk: estimatedPropellantKg must be a finite number. Received: ${requirements.estimatedPropellantKg}`
        );
      }
      if (requirements.estimatedPropellantKg < 0) {
        throw new RangeError(
          `evaluateRisk: estimatedPropellantKg cannot be negative. Received: ${requirements.estimatedPropellantKg}`
        );
      }
    }

    if (requirements.estimatedPowerWatts !== undefined) {
      if (typeof requirements.estimatedPowerWatts !== 'number' || !Number.isFinite(requirements.estimatedPowerWatts)) {
        throw new TypeError(
          `evaluateRisk: estimatedPowerWatts must be a finite number. Received: ${requirements.estimatedPowerWatts}`
        );
      }
    }

    if (requirements.estimatedStorageBytes !== undefined) {
      if (typeof requirements.estimatedStorageBytes !== 'number' || !Number.isFinite(requirements.estimatedStorageBytes)) {
        throw new TypeError(
          `evaluateRisk: estimatedStorageBytes must be a finite number. Received: ${requirements.estimatedStorageBytes}`
        );
      }
      if (requirements.estimatedStorageBytes < 0) {
        throw new RangeError(
          `evaluateRisk: estimatedStorageBytes cannot be negative. Received: ${requirements.estimatedStorageBytes}`
        );
      }
    }

    if (requirements.estimatedDurationSeconds !== undefined) {
      if (typeof requirements.estimatedDurationSeconds !== 'number' || !Number.isFinite(requirements.estimatedDurationSeconds)) {
        throw new TypeError(
          `evaluateRisk: estimatedDurationSeconds must be a finite number. Received: ${requirements.estimatedDurationSeconds}`
        );
      }
      if (requirements.estimatedDurationSeconds < 0) {
        throw new RangeError(
          `evaluateRisk: estimatedDurationSeconds cannot be negative. Received: ${requirements.estimatedDurationSeconds}`
        );
      }
    }

    const risks: RiskItem[] = [];

    // 1. Spacecraft Flight State Safety Check
    if (snapshot) {
      const isSafeMode = snapshot.flightState === 'SAFE_MODE';
      const isPrelaunchHold = snapshot.flightState === 'PRELAUNCH_HOLD';
      if (isSafeMode || isPrelaunchHold) {
        risks.push({
          id: `risk-safety-state-${currentMET}`,
          category: 'SAFETY',
          severity: 'CRITICAL',
          deterministicRiskScore: RISK_SEVERITY_SCORES.CRITICAL,
          supportingEvidenceIds: [...supportingEvidenceIds],
          explanation: `Spacecraft is currently in ${snapshot.flightState}. Flight software strictly forbids payload operations until nominal recovery is verified.`,
          mitigation: 'Execute flight software recovery procedure and resolve all active anomalies first.',
          isHardConstraint: true,
        });
      }

      // 2. Critical Fault Check
      if (snapshot.criticalFaultCount > 0) {
        risks.push({
          id: `risk-critical-faults-${currentMET}`,
          category: 'SUBSYSTEM',
          severity: 'CRITICAL',
          deterministicRiskScore: RISK_SEVERITY_SCORES.CRITICAL,
          supportingEvidenceIds: [...supportingEvidenceIds],
          explanation: `${snapshot.criticalFaultCount} active CRITICAL fault(s) detected across spacecraft avionics. Subsystem recovery guard active.`,
          mitigation: 'Isolate faulted hardware and verify recovery gates prior to commanding.',
          isHardConstraint: true,
        });
      }

      // 3. Subsystem Health Check
      if (requirements.requiredSubsystems && requirements.requiredSubsystems.length > 0) {
        for (const subsys of requirements.requiredSubsystems) {
          const status = snapshot.subsystemStatuses[subsys];
          if (status === 'FAULT' || status === 'OFF') {
            risks.push({
              id: `risk-subsys-${subsys}-${currentMET}`,
              category: 'SUBSYSTEM',
              severity: 'CRITICAL',
              deterministicRiskScore: RISK_SEVERITY_SCORES.CRITICAL,
              supportingEvidenceIds: [...supportingEvidenceIds],
              explanation: `Required subsystem '${subsys}' is in '${status ?? 'UNKNOWN'}' state.`,
              mitigation: `Power on or recover subsystem '${subsys}' before initiating operation.`,
              isHardConstraint: true,
            });
          } else if (status === 'DEGRADED') {
            risks.push({
              id: `risk-subsys-deg-${subsys}-${currentMET}`,
              category: 'SUBSYSTEM',
              severity: 'MODERATE',
              deterministicRiskScore: RISK_SEVERITY_SCORES.MODERATE,
              supportingEvidenceIds: [...supportingEvidenceIds],
              explanation: `Required subsystem '${subsys}' is DEGRADED. Operational capability may be compromised.`,
              mitigation: 'Monitor performance telemetry continuously during execution.',
              isHardConstraint: false,
            });
          }
        }
      }

      // 4. Power Margin Check
      if (snapshot.powerBudget) {
        const margin = snapshot.powerBudget.powerReservePercent;
        if (margin < AEROSPACE_SAFETY_THRESHOLDS.MIN_CRITICAL_POWER_MARGIN_PERCENT) {
          risks.push({
            id: `risk-power-deficit-${currentMET}`,
            category: 'POWER',
            severity: 'CRITICAL',
            deterministicRiskScore: RISK_SEVERITY_SCORES.CRITICAL,
            supportingEvidenceIds: [...supportingEvidenceIds],
            explanation: `Spacecraft electrical power deficit: margin is ${margin.toFixed(1)}% (below critical 0.0%).`,
            mitigation: 'Shed non-essential electrical loads immediately.',
            isHardConstraint: true,
          });
        } else if (margin < AEROSPACE_SAFETY_THRESHOLDS.MIN_NOMINAL_POWER_MARGIN_PERCENT) {
          risks.push({
            id: `risk-power-low-${currentMET}`,
            category: 'POWER',
            severity: 'HIGH',
            deterministicRiskScore: RISK_SEVERITY_SCORES.HIGH,
            supportingEvidenceIds: [...supportingEvidenceIds],
            explanation: `Electrical power reserve margin is low: ${margin.toFixed(1)}% (minimum recommended: ${
              AEROSPACE_SAFETY_THRESHOLDS.MIN_NOMINAL_POWER_MARGIN_PERCENT
            }%).`,
            mitigation: 'Minimize concurrent high-power emitter operations.',
            isHardConstraint: false,
          });
        }
      }

      // 5. Thermal Limits Check
      if (snapshot.thermalModel) {
        const temp = snapshot.thermalModel.equilibriumTemperatureKelvin;
        const minTemp = snapshot.thermalModel.minOperatingTempKelvin;
        const maxTemp = snapshot.thermalModel.maxOperatingTempKelvin;

        if (temp < minTemp || temp > maxTemp) {
          risks.push({
            id: `risk-thermal-breach-${currentMET}`,
            category: 'THERMAL',
            severity: 'CRITICAL',
            deterministicRiskScore: RISK_SEVERITY_SCORES.CRITICAL,
            supportingEvidenceIds: [...supportingEvidenceIds],
            explanation: `Spacecraft thermal equilibrium (${temp.toFixed(1)} K) violates allowable bounds [${minTemp.toFixed(
              0
            )} K, ${maxTemp.toFixed(0)} K].`,
            mitigation: 'Activate thermal survival heaters or reorient solar radiating surface.',
            isHardConstraint: true,
          });
        } else if (
          temp - minTemp < AEROSPACE_SAFETY_THRESHOLDS.MIN_THERMAL_BUFFER_KELVIN ||
          maxTemp - temp < AEROSPACE_SAFETY_THRESHOLDS.MIN_THERMAL_BUFFER_KELVIN
        ) {
          risks.push({
            id: `risk-thermal-buffer-${currentMET}`,
            category: 'THERMAL',
            severity: 'MODERATE',
            deterministicRiskScore: RISK_SEVERITY_SCORES.MODERATE,
            supportingEvidenceIds: [...supportingEvidenceIds],
            explanation: `Thermal buffer is narrow (${Math.min(temp - minTemp, maxTemp - temp).toFixed(
              1
            )} K to limit).`,
            mitigation: 'Duty-cycle thermal dissipation elements.',
            isHardConstraint: false,
          });
        }
      }

      // 6. Propellant Headroom Check
      if (requirements.estimatedPropellantKg && requirements.estimatedPropellantKg > 0) {
        if (snapshot.availablePropellantKg !== undefined) {
          if (snapshot.availablePropellantKg < requirements.estimatedPropellantKg) {
            risks.push({
              id: `risk-propellant-exhaustion-${currentMET}`,
              category: 'PROPELLANT',
              severity: 'CRITICAL',
              deterministicRiskScore: RISK_SEVERITY_SCORES.CRITICAL,
              supportingEvidenceIds: [...supportingEvidenceIds],
              explanation: `Required propellant (${requirements.estimatedPropellantKg.toFixed(
                1
              )} kg) exceeds remaining onboard reserves (${snapshot.availablePropellantKg.toFixed(1)} kg).`,
              mitigation: 'Cancel maneuver or re-plan trajectory with lower delta-V expenditure.',
              isHardConstraint: true,
            });
          }
        }
      }

      // 7. Onboard Storage Headroom Check
      if (requirements.estimatedStorageBytes && requirements.estimatedStorageBytes > 0) {
        if (snapshot.storageCapacityBytes !== undefined && snapshot.storageUsedBytes !== undefined) {
          const availableBytes = Math.max(0, snapshot.storageCapacityBytes - snapshot.storageUsedBytes);
          if (availableBytes < requirements.estimatedStorageBytes) {
            risks.push({
              id: `risk-storage-overflow-${currentMET}`,
              category: 'STORAGE',
              severity: 'CRITICAL',
              deterministicRiskScore: RISK_SEVERITY_SCORES.CRITICAL,
              supportingEvidenceIds: [...supportingEvidenceIds],
              explanation: `Required science storage (${(requirements.estimatedStorageBytes / 1024).toFixed(
                0
              )} KB) exceeds available solid-state recorder capacity (${(availableBytes / 1024).toFixed(0)} KB).`,
              mitigation: 'Downlink and purge acknowledged telemetry packets before recording.',
              isHardConstraint: true,
            });
          } else if (availableBytes - requirements.estimatedStorageBytes < AEROSPACE_SAFETY_THRESHOLDS.MIN_STORAGE_HEADROOM_BYTES) {
            risks.push({
              id: `risk-storage-headroom-${currentMET}`,
              category: 'STORAGE',
              severity: 'LOW',
              deterministicRiskScore: RISK_SEVERITY_SCORES.LOW,
              supportingEvidenceIds: [...supportingEvidenceIds],
              explanation: 'Storage buffer will be near saturation following data acquisition.',
              mitigation: 'Schedule downlink pass to avoid telemetry queue throttling.',
              isHardConstraint: false,
            });
          }
        }
      }

      // 8. Communication Link Availability Check
      if (requirements.requiresActiveCommWindow) {
        if (snapshot.isCommWindowActive === false) {
          risks.push({
            id: `risk-comm-unavail-${currentMET}`,
            category: 'COMMUNICATIONS',
            severity: 'HIGH',
            deterministicRiskScore: RISK_SEVERITY_SCORES.HIGH,
            supportingEvidenceIds: [...supportingEvidenceIds],
            explanation: 'No Deep Space Network ground station communication window is currently active.',
            mitigation: 'Hold data in onboard storage until next scheduled station pass.',
            isHardConstraint: false,
          });
        }
      }
    }

    // Baseline nominal risk if no concerns detected
    if (risks.length === 0) {
      risks.push({
        id: `risk-nominal-${currentMET}`,
        category: 'SAFETY',
        severity: 'NEGLIGIBLE',
        deterministicRiskScore: RISK_SEVERITY_SCORES.NEGLIGIBLE,
        supportingEvidenceIds: [...supportingEvidenceIds],
        explanation: 'All aerospace subsystems, power margins, and thermal parameters are nominal.',
        mitigation: 'Proceed with planned operational sequence.',
        isHardConstraint: false,
      });
    }

    // Determine highest severity
    let highestSeverity: RiskSeverity = 'NEGLIGIBLE';
    const severityRank: Record<RiskSeverity, number> = {
      NEGLIGIBLE: 0,
      LOW: 1,
      MODERATE: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    let hasHardConstraintViolation = false;
    let sumScore = 0;
    let maxScore = 0;

    for (const r of risks) {
      if (severityRank[r.severity] > severityRank[highestSeverity]) {
        highestSeverity = r.severity;
      }
      if (r.isHardConstraint && r.severity === 'CRITICAL') {
        hasHardConstraintViolation = true;
      }
      sumScore += r.deterministicRiskScore;
      if (r.deterministicRiskScore > maxScore) {
        maxScore = r.deterministicRiskScore;
      }
    }

    // Composite deterministic risk score: 60% max risk + 40% mean risk
    const meanScore = sumScore / risks.length;
    const compositeScore = Math.min(100.0, Math.round((maxScore * 0.6 + meanScore * 0.4) * 10) / 10);
    const isAcceptable =
      !hasHardConstraintViolation && compositeScore <= AEROSPACE_SAFETY_THRESHOLDS.MAX_ACCEPTABLE_EXECUTION_RISK_SCORE;

    return {
      compositeRiskScore: compositeScore,
      highestSeverity,
      hasHardConstraintViolation,
      risks,
      isAcceptableForExecution: isAcceptable,
      evaluationMET: currentMET,
    };
  }
}
