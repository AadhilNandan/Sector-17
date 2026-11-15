/**
 * SECTOR 17 — Decision Executor
 * Executes approved mission decisions deterministically through existing spacecraft avionics:
 * CommandExecutor, CommandQueue, SubsystemManager, ScienceProcessingManager, and TelemetryQueue.
 *
 * SAFETY INVARIANTS:
 * 1. Only APPROVED decisions may be executed; REJECTED or EXPIRED decisions are strictly barred.
 * 2. Revalidation Gate: Re-evaluates decision feasibility immediately prior to execution;
 *    if engineering margins or flight states have changed, execution is safely aborted.
 * 3. Safe-mode authority: SAFE_MODE restrictions remain authoritative.
 * 4. Spacecraft command pathway: Dispatches typed CommandPackets through the existing CommandExecutor.
 */

import type { FlightComputer } from '../flightSoftware/flightComputer';
import type { CommandExecutor } from '../flightSoftware/commandExecutor';
import type { SubsystemManager } from '../flightSoftware/subsystemManager';
import type { ScienceProcessingManager } from '../science/scienceProcessingManager';
import type { CommunicationManager } from '../communications/communicationManager';
import type { CommandPacket } from '../communications/types';
import type { DecisionValidator } from './decisionValidator';
import type { DecisionAuthorizationEngine } from './decisionAuthorization';
import type { MissionConsequenceEngine } from './missionConsequenceEngine';
import type { DecisionEvidenceManager } from './decisionEvidence';
import type { MissionObjectiveEvaluator } from './missionObjectiveEvaluator';
import type { DecisionExecutionResult, MissionConsequence, SpacecraftEngineeringSnapshot } from './types';

export interface DecisionExecutorDependencies {
  flightComputer?: FlightComputer;
  commandExecutor?: CommandExecutor;
  subsystemManager?: SubsystemManager;
  scienceManager?: ScienceProcessingManager;
  commManager?: CommunicationManager;
  navManager?: any;
  runtime?: any;
  validator: DecisionValidator;
  authorizationEngine: DecisionAuthorizationEngine;
  consequenceEngine: MissionConsequenceEngine;
  evidenceManager: DecisionEvidenceManager;
  objectiveEvaluator: MissionObjectiveEvaluator;
}

export class DecisionExecutor {
  private deps: DecisionExecutorDependencies;

  constructor(deps: DecisionExecutorDependencies) {
    this.deps = deps;
  }

  public attachDependencies(overrides: Partial<DecisionExecutorDependencies>): void {
    this.deps = { ...this.deps, ...overrides };
  }

  /**
   * Executes an authorized decision against the spacecraft simulation core.
   */
  public async executeDecision(decisionId: string, currentMET: number): Promise<DecisionExecutionResult> {
    const record = this.deps.authorizationEngine.getRecord(decisionId.trim());
    if (!record) {
      throw new Error(`DecisionExecutor.executeDecision: Decision '${decisionId}' not found.`);
    }

    if (record.status !== 'APPROVED') {
      const err = `Cannot execute decision '${decisionId}'; current status is '${record.status}'. Expected 'APPROVED'.`;
      return {
        decisionId,
        success: false,
        executedAtMET: currentMET,
        consequences: [],
        errorMessage: err,
      };
    }

    // 1. Revalidation Pre-flight Gate
    // Re-verify spacecraft telemetry and safety constraints immediately prior to execution
    const snapshot = this.deps.evidenceManager.getEngineeringSnapshot();
    const reval = this.deps.validator.validate(
      record.option,
      snapshot,
      this.deps.objectiveEvaluator,
      currentMET
    );

    if (reval.status !== 'FEASIBLE') {
      const err = `Pre-flight revalidation failed: Decision is ${reval.status} (${reval.reasons.join('; ')}).`;
      return this.abortExecution(record, err, currentMET);
    }

    // 2. Authoritative Resource Sufficiency Pre-execution Gate (C-06)
    const subManager = this.deps.subsystemManager ?? this.deps.flightComputer?.getSubsystemManager();
    const commManager = this.deps.commManager ?? this.deps.flightComputer?.getCommunicationManager();

    const reqPropellantKg =
      record.option.resourceRequirements?.estimatedPropellantKg ??
      (record.option.category === 'DEPLOY_LANDER' ? 25.0 : 0);
    const reqStorageBytes = record.option.resourceRequirements?.estimatedStorageBytes ?? 0;

    let propSub: any = undefined;
    if (reqPropellantKg > 0) {
      const sub = subManager?.getSubsystem('PROPULSION');
      if (!sub || typeof (sub as any).getPropellantRemainingKg !== 'function') {
        const err = `Resource validation failed: Required ${reqPropellantKg} kg propellant but PropulsionSubsystem is not available.`;
        return this.abortExecution(record, err, currentMET);
      }
      propSub = sub;
      if (typeof propSub.areValvesIsolated === 'function' && propSub.areValvesIsolated()) {
        const err = `Resource validation failed: Cannot consume propellant while thruster valves are isolated in SAFE mode.`;
        return this.abortExecution(record, err, currentMET);
      }
      const remainingKg = propSub.getPropellantRemainingKg();
      if (remainingKg < reqPropellantKg) {
        const err = `Resource validation failed: Insufficient propellant remaining (${remainingKg.toFixed(1)} kg available, ${reqPropellantKg.toFixed(1)} kg required).`;
        return this.abortExecution(record, err, currentMET);
      }
    }

    let storage: any = undefined;
    if (reqStorageBytes > 0) {
      if (commManager) {
        storage = commManager.getStorage();
        const availableBytes = storage.getAvailableStorageBytes();
        if (availableBytes < reqStorageBytes) {
          const err = `Resource validation failed: Insufficient onboard storage capacity (${availableBytes} bytes available, ${reqStorageBytes} bytes required).`;
          return this.abortExecution(record, err, currentMET);
        }
      }
    }

    // Mark decision as EXECUTING in lifecycle
    this.deps.authorizationEngine.markExecuting(decisionId, currentMET);

    const consequences: MissionConsequence[] = [];
    let dispatchedCommandId: string | undefined;
    let downlinkedPacketId: string | undefined;
    let executionSuccess = true;
    let errorMessage: string | undefined;

    try {
      // 2. Command Dispatch Integration
      if (record.option.commandTypeToDispatch) {
        const cmdId = `cmd-${record.option.id}-${currentMET}`;
        dispatchedCommandId = cmdId;

        const cmdPacket: CommandPacket = {
          id: cmdId,
          type: record.option.commandTypeToDispatch,
          payload: record.option.commandPayload,
          priority: 150,
          sizeBytes: 64,
          scheduledTxTimeMET: currentMET,
          txDurationSeconds: 0,
          oneWayLightTimeSeconds: 0,
          arrivalMETSeconds: currentMET, // Local flight computer execution
          status: 'ARRIVED',
        };

        const commandExecutor = this.deps.commandExecutor ?? this.deps.flightComputer?.getCommandExecutor();
        if (commandExecutor) {
          const res = await commandExecutor.executeCommand(cmdPacket, currentMET);
          if (!res.success) {
            executionSuccess = false;
            errorMessage = res.error ?? 'Command execution rejected by flight computer.';
          } else {
            consequences.push(
              this.deps.consequenceEngine.recordConsequence(
                'COMMAND_DISPATCHED',
                `Flight command '${cmdPacket.type}' successfully executed on AETHON core.`,
                cmdId,
                cmdPacket.type,
                currentMET
              )
            );
          }
        } else {
          // If no CommandExecutor attached, simulate local flight software dispatch
          consequences.push(
            this.deps.consequenceEngine.recordConsequence(
              'COMMAND_DISPATCHED',
              `Flight command '${cmdPacket.type}' dispatched directly to avionics.`,
              cmdId,
              cmdPacket.type,
              currentMET
            )
          );
        }
      }

      // 3. Category-Specific Physical Implementations & Resource Mutations (C-06)
      if (executionSuccess) {
        // Authoritative propellant expenditure (C-06)
        if (reqPropellantKg > 0 && propSub) {
          propSub.consumePropellant(reqPropellantKg);
          const remaining = propSub.getPropellantRemainingKg();
          consequences.push(
            this.deps.consequenceEngine.recordConsequence(
              'RESOURCE_EXPENDITURE',
              `Propellant expended: ${reqPropellantKg.toFixed(1)} kg. Authoritative reserve remaining: ${remaining.toFixed(1)} kg.`,
              'PROPULSION',
              -reqPropellantKg,
              currentMET
            )
          );
        }

        // Authoritative storage allocation (C-06)
        if (reqStorageBytes > 0 && storage) {
          const packetId = `pkt-storage-${record.option.id}-${currentMET}`;
          storage.storeData({
            id: packetId,
            category: 'science',
            sizeBytes: reqStorageBytes,
            creationMETSeconds: currentMET,
            payload: {
              decisionId: record.option.id,
              category: record.option.category,
              description: record.option.title,
            },
          });
          consequences.push(
            this.deps.consequenceEngine.recordConsequence(
              'RESOURCE_EXPENDITURE',
              `Allocated ${reqStorageBytes} bytes in authoritative solid-state memory for science data.`,
              'STORAGE',
              reqStorageBytes,
              currentMET
            )
          );
        }

        // Dynamic snapshot synchronization for immediate queries
        const snap = this.deps.evidenceManager.getEngineeringSnapshot();
        if (snap) {
          const sState = storage ? storage.getStorageState() : undefined;
          const updatedSnap: SpacecraftEngineeringSnapshot = {
            ...snap,
            availablePropellantKg: propSub ? propSub.getPropellantRemainingKg() : snap.availablePropellantKg,
            storageCapacityBytes: sState ? sState.totalCapacityBytes : snap.storageCapacityBytes,
            storageUsedBytes: sState ? sState.usedStorageBytes : snap.storageUsedBytes,
          };
          this.deps.evidenceManager.ingestEngineeringSnapshot(updatedSnap);
        }

        switch (record.option.category) {
          case 'CONTINUE_INVESTIGATION': {
            consequences.push(
              this.deps.consequenceEngine.recordConsequence(
                'SUBSYSTEM_STATE_CHANGE',
                'Science instruments reconfigured for active survey profile.',
                'subsys-science-payload',
                'SURVEY',
                currentMET
              )
            );
            consequences.push(
              this.deps.consequenceEngine.recordConsequence(
                'RESOURCE_EXPENDITURE',
                'Allocated electrical power and recording memory for science observations.',
                'powerBudget/storage',
                -150.0,
                currentMET
              )
            );
            break;
          }

          case 'PRIORITIZE_ANOMALY': {
            const scienceManager = this.deps.scienceManager ?? this.deps.flightComputer?.getScienceManager();
            if (scienceManager) {
              scienceManager.getSubsystem().setInstrumentMode('REASON', 'HIGH_RESOLUTION');
              scienceManager.getSubsystem().setInstrumentMode('MASPEX', 'HIGH_RESOLUTION');
            }
            consequences.push(
              this.deps.consequenceEngine.recordConsequence(
                'SUBSYSTEM_STATE_CHANGE',
                'Science Payload transitioned to HIGH_RESOLUTION focused on targeted anomaly.',
                'subsys-science-payload',
                'HIGH_RESOLUTION',
                currentMET
              )
            );
            consequences.push(
              this.deps.consequenceEngine.recordConsequence(
                'RESOURCE_EXPENDITURE',
                'High-resolution radar chirping and mass spectrometry sampling engaged.',
                'powerBudget',
                -220.0,
                currentMET
              )
            );
            break;
          }

          case 'PRESERVE_SPACECRAFT': {
            const subsystemManager = this.deps.subsystemManager ?? this.deps.flightComputer?.getSubsystemManager();
            if (subsystemManager) {
              const scienceSub = subsystemManager.getSubsystem('SCIENCE');
              if (scienceSub) {
                scienceSub.setStatus('NOMINAL', 'Load shedding requested', currentMET);
              }
            }
            consequences.push(
              this.deps.consequenceEngine.recordConsequence(
                'RESOURCE_EXPENDITURE',
                'Secondary electrical loads throttled, conserving 80W power reserve.',
                'powerBudget',
                80.0,
                currentMET
              )
            );
            break;
          }

          case 'TRANSMIT_FINDINGS': {
            const commManager = this.deps.commManager ?? this.deps.flightComputer?.getCommunicationManager();
            const scienceManager = this.deps.scienceManager ?? this.deps.flightComputer?.getScienceManager();
            const evidenceItems = this.deps.evidenceManager.getVerifiedEvidence();

            if (scienceManager && evidenceItems.length > 0) {
              const topProduct = evidenceItems.find((e) => e.sourceType === 'SCIENCE_PRODUCT');
              if (topProduct) {
                downlinkedPacketId = `tlm-pkt-${topProduct.sourceId}`;
                consequences.push(
                  this.deps.consequenceEngine.recordConsequence(
                    'TELEMETRY_QUEUED',
                    `Queued verified science product '${topProduct.sourceId}' for Earth downlink.`,
                    downlinkedPacketId,
                    true,
                    currentMET
                  )
                );
              }
            } else if (commManager) {
              downlinkedPacketId = `tlm-pkt-generic-${currentMET}`;
              commManager.getTelemetryQueue().enqueue({
                id: downlinkedPacketId,
                category: 'science',
                payload: { report: 'Verified science findings' },
                priority: 100,
                sizeBytes: 8192,
              });
              consequences.push(
                this.deps.consequenceEngine.recordConsequence(
                  'TELEMETRY_QUEUED',
                  'Queued telemetry transmission frame to DSN queue.',
                  downlinkedPacketId,
                  true,
                  currentMET
                )
              );
            }
            break;
          }

          case 'DEPLOY_LANDER': {
            if (record.option.commandTypeToDispatch === 'AUTHORIZE_EUROPA_PARKING_ORBIT') {
              if (this.deps.navManager && typeof this.deps.navManager.authorizeParkingOrbitAssumption === 'function') {
                this.deps.navManager.authorizeParkingOrbitAssumption(currentMET);
              }
              consequences.push(
                this.deps.consequenceEngine.recordConsequence(
                  'SUBSYSTEM_STATE_CHANGE',
                  '100 km Europa circular parking-orbit staging assumption authorized.',
                  'subsys-gnc',
                  'PARKING_ORBIT_AUTHORIZED',
                  currentMET
                )
              );
              break;
            }

            const subsystemManager = this.deps.subsystemManager ?? this.deps.flightComputer?.getSubsystemManager();
            if (subsystemManager) {
              const landerSub = subsystemManager.getSubsystem('LANDER_ROVER');
              if (landerSub) {
                landerSub.setStatus('NOMINAL', 'Lander deployment initiated', currentMET);
              }
            }
            consequences.push(
              this.deps.consequenceEngine.recordConsequence(
                'SUBSYSTEM_STATE_CHANGE',
                'Europa Surface Lander deployed and detached from AETHON orbiter bus.',
                'subsys-lander-rover',
                'DEPLOYED',
                currentMET
              )
            );
            break;
          }

          case 'ABORT_OR_SUSPEND': {
            if (this.deps.flightComputer) {
              this.deps.flightComputer.transitionState('SAFE_MODE', 'Decision engine suspension commanded');
            }
            consequences.push(
              this.deps.consequenceEngine.recordConsequence(
                'SUBSYSTEM_STATE_CHANGE',
                'Spacecraft autonomous safe mode triggered. Payload systems halted.',
                'flightComputer',
                'SAFE_MODE',
                currentMET
              )
            );
            break;
          }

          case 'LAUNCH_AUTHORIZATION': {
            if (this.deps.flightComputer) {
              const execCtrl = this.deps.flightComputer.getExecutionController();
              if (execCtrl.getState() === 'INITIALIZED') {
                execCtrl.transitionTo('STANDBY', currentMET, 'Launch authorization confirmed: countdown ready.');
              }
            }
            if ((this.deps as any).runtime && typeof (this.deps as any).runtime.authorizeLaunch === 'function') {
              (this.deps as any).runtime.authorizeLaunch(currentMET);
            }
            consequences.push(
              this.deps.consequenceEngine.recordConsequence(
                'COMMAND_DISPATCHED',
                'Flight Director Go/No-Go operational poll unanimous GO. Launch countdown authorized.',
                'flightDirectorConsole',
                'GO_CONFIRMED',
                currentMET
              )
            );
            break;
          }
        }

        // 4. Update Mission Objectives Post-Decision
        this.deps.objectiveEvaluator.evaluateAllObjectives(this.deps.evidenceManager, currentMET);
      }
    } catch (err: any) {
      executionSuccess = false;
      errorMessage = err?.message ?? 'Unexpected error during decision execution.';
    }

    const result: DecisionExecutionResult = {
      decisionId,
      success: executionSuccess,
      executedAtMET: currentMET,
      dispatchedCommandId,
      downlinkedPacketId,
      consequences,
      errorMessage,
    };

    // Transition decision lifecycle in authorization engine
    this.deps.authorizationEngine.markCompleted(decisionId, result, currentMET);

    return result;
  }

  private abortExecution(
    record: any,
    errorMessage: string,
    currentMET: number
  ): DecisionExecutionResult {
    this.deps.authorizationEngine.markExecuting(record.option.id, currentMET);
    const failedResult: DecisionExecutionResult = {
      decisionId: record.option.id,
      success: false,
      executedAtMET: currentMET,
      consequences: [],
      errorMessage,
    };
    this.deps.authorizationEngine.markCompleted(record.option.id, failedResult, currentMET);
    return failedResult;
  }
}
