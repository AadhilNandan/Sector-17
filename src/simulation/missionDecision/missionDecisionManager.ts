/**
 * SECTOR 17 — Mission Decision & Response Manager
 * High-level orchestrator integrating evidence ingestion, objective evaluation,
 * risk assessment, decision option generation, aerospace validation, commander authorization,
 * flight software execution, and immutable audit history.
 */

import { DecisionEvidenceManager } from './decisionEvidence';
import { MissionObjectiveEvaluator } from './missionObjectiveEvaluator';
import { RiskAssessmentEngine } from './riskAssessment';
import { DecisionOptionGenerator } from './decisionOptionGenerator';
import { DecisionValidator } from './decisionValidator';
import { DecisionAuthorizationEngine } from './decisionAuthorization';
import { MissionConsequenceEngine } from './missionConsequenceEngine';
import { DecisionExecutor } from './decisionExecutor';
import { DecisionHistoryTracker } from './decisionHistory';
import type { FlightComputer } from '../flightSoftware/flightComputer';
import type { CommunicationManager } from '../communications/communicationManager';
import type { ScienceProcessingManager } from '../science/scienceProcessingManager';
import type { MissionEventEngine } from '../operations/missionEventEngine';
import type {
  DecisionOption,
  DecisionRecord,
  DecisionExecutionResult,
  SpacecraftEngineeringSnapshot,
  ObjectiveEvaluationReport,
} from './types';
import type { ScienceProductLevel2, ScienceAnomalyReport } from '../science/types';

export class MissionDecisionManager {
  private evidenceManager: DecisionEvidenceManager;
  private objectiveEvaluator: MissionObjectiveEvaluator;
  private riskEngine: RiskAssessmentEngine;
  private optionGenerator: DecisionOptionGenerator;
  private validator: DecisionValidator;
  private authorizationEngine: DecisionAuthorizationEngine;
  private consequenceEngine: MissionConsequenceEngine;
  private executor: DecisionExecutor;
  private historyTracker: DecisionHistoryTracker;

  private flightComputer?: FlightComputer;
  private commManager?: CommunicationManager;
  private scienceManager?: ScienceProcessingManager;
  private eventEngine?: MissionEventEngine;
  private navManager?: any;
  private campaignManager?: any;

  constructor() {
    this.evidenceManager = new DecisionEvidenceManager();
    this.objectiveEvaluator = new MissionObjectiveEvaluator();
    this.riskEngine = new RiskAssessmentEngine();
    this.optionGenerator = new DecisionOptionGenerator(this.riskEngine);
    this.validator = new DecisionValidator();
    this.authorizationEngine = new DecisionAuthorizationEngine();
    this.consequenceEngine = new MissionConsequenceEngine();
    this.historyTracker = new DecisionHistoryTracker();

    this.executor = new DecisionExecutor({
      validator: this.validator,
      authorizationEngine: this.authorizationEngine,
      consequenceEngine: this.consequenceEngine,
      evidenceManager: this.evidenceManager,
      objectiveEvaluator: this.objectiveEvaluator,
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Subsystem & Engine Attachments                                             */
  /* -------------------------------------------------------------------------- */

  public attachFlightComputer(flightComputer: FlightComputer): void {
    this.flightComputer = flightComputer;
    this.executor.attachDependencies({
      flightComputer,
      commandExecutor: flightComputer.getCommandExecutor(),
      subsystemManager: flightComputer.getSubsystemManager(),
    });

    const comms = flightComputer.getCommunicationManager();
    if (comms) {
      this.attachCommunicationManager(comms);
    }

    const science = flightComputer.getScienceManager();
    if (science) {
      this.attachScienceManager(science);
    }

    const eventEngine = flightComputer.getEventEngine();
    if (eventEngine) {
      this.attachEventEngine(eventEngine);
    }
  }

  public attachCommunicationManager(commManager: CommunicationManager): void {
    this.commManager = commManager;
    this.executor.attachDependencies({ commManager });
  }

  public attachScienceManager(scienceManager: ScienceProcessingManager): void {
    this.scienceManager = scienceManager;
    this.executor.attachDependencies({ scienceManager });
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
    this.objectiveEvaluator.attachEventEngine(engine);
    this.authorizationEngine.attachEventEngine(engine);
    this.consequenceEngine.attachEventEngine(engine);
  }

  public attachNavigationManager(navManager: any): void {
    this.navManager = navManager;
    this.executor.attachDependencies({ navManager });
  }

  public attachCampaignManager(campaignManager: any): void {
    this.campaignManager = campaignManager;
  }

  public attachRuntime(runtime: any): void {
    this.executor.attachDependencies({ runtime });
  }

  /* -------------------------------------------------------------------------- */
  /* Evidence & Telemetry Synchronization                                       */
  /* -------------------------------------------------------------------------- */

  /**
   * Synchronizes live avionics and subsystem telemetry into an engineering snapshot.
   */
  public syncEngineeringSnapshot(currentMET: number): SpacecraftEngineeringSnapshot {
    const existing = this.evidenceManager.getEngineeringSnapshot();
    const navPhase = this.navManager?.getCurrentPhase?.() ?? existing?.navigationPhase;
    const campStage = this.campaignManager?.getCurrentStageId?.() ?? existing?.campaignStageId;
    const parkingAuth = this.navManager
      ? typeof this.navManager.isParkingOrbitPrerequisiteAuthorized === 'function'
        ? this.navManager.isParkingOrbitPrerequisiteAuthorized()
        : false
      : existing?.parkingOrbitPrerequisiteMet;

    if (!this.flightComputer) {
      const emptySnapshot: SpacecraftEngineeringSnapshot = {
        currentMET,
        flightState: 'STANDBY',
        subsystemStatuses: {} as any,
        activeFaultCount: 0,
        criticalFaultCount: 0,
        parkingOrbitPrerequisiteMet: parkingAuth,
        navigationPhase: navPhase,
        campaignStageId: campStage,
        readinessCertified: existing?.readinessCertified,
        engineeringValidationStatus: existing?.engineeringValidationStatus,
      };
      this.evidenceManager.ingestEngineeringSnapshot(emptySnapshot);
      return emptySnapshot;
    }

    const subManager = this.flightComputer.getSubsystemManager();
    const faultManager = this.flightComputer.getFaultManager();
    const execController = this.flightComputer.getExecutionController();
    const commManager = this.commManager ?? this.flightComputer.getCommunicationManager();

    let storageCapacity: number | undefined;
    let storageUsed: number | undefined;
    let isCommWindowActive = false;

    if (commManager) {
      const storageState = commManager.getStorage().getStorageState();
      storageCapacity = storageState.totalCapacityBytes;
      storageUsed = storageState.usedStorageBytes;

      const pointingTarget = this.flightComputer.getResolvedECEFPosition(currentMET);
      const visible = commManager.evaluateVisibility(pointingTarget, currentMET);
      isCommWindowActive = visible.length > 0;
    }

    let availablePropellantKg: number | undefined = existing?.availablePropellantKg;
    const propSub = subManager.getSubsystem('PROPULSION');
    if (propSub && 'getPropellantRemainingKg' in propSub && typeof (propSub as any).getPropellantRemainingKg === 'function') {
      availablePropellantKg = (propSub as any).getPropellantRemainingKg();
    }

    const snapshot: SpacecraftEngineeringSnapshot = {
      currentMET,
      flightState: execController.getState(),
      subsystemStatuses: subManager.getStatuses(),
      activeFaultCount: faultManager.getActiveFaults().length,
      criticalFaultCount: faultManager.getFaultsBySeverity('CRITICAL').length,
      storageCapacityBytes: storageCapacity,
      storageUsedBytes: storageUsed,
      isCommWindowActive,
      powerBudget: existing?.powerBudget,
      thermalModel: existing?.thermalModel,
      massBudget: existing?.massBudget,
      availablePropellantKg,
      currentRoundTripLightTimeSeconds: existing?.currentRoundTripLightTimeSeconds,
      parkingOrbitPrerequisiteMet: parkingAuth,
      navigationPhase: navPhase,
      campaignStageId: campStage,
      readinessCertified: existing?.readinessCertified,
      engineeringValidationStatus: existing?.engineeringValidationStatus,
    };

    this.evidenceManager.ingestEngineeringSnapshot(snapshot);
    return snapshot;
  }

  public ingestScienceProduct(product: ScienceProductLevel2, currentMET: number) {
    const item = this.evidenceManager.ingestScienceProduct(product, currentMET);
    this.objectiveEvaluator.evaluateAllObjectives(this.evidenceManager, currentMET);
    return item;
  }

  public ingestAnomalyReport(anomaly: ScienceAnomalyReport, currentMET: number) {
    const item = this.evidenceManager.ingestAnomalyReport(anomaly, currentMET);
    this.objectiveEvaluator.evaluateAllObjectives(this.evidenceManager, currentMET);
    return item;
  }

  /* -------------------------------------------------------------------------- */
  /* Operational Workflow                                                       */
  /* -------------------------------------------------------------------------- */

  /**
   * Evaluates all mission objectives against current evidence.
   */
  public evaluateObjectives(currentMET: number): ObjectiveEvaluationReport[] {
    return this.objectiveEvaluator.evaluateAllObjectives(this.evidenceManager, currentMET);
  }

  /**
   * Generates and validates candidate decision options from current evidence and telemetry.
   */
  public generateAndValidateOptions(currentMET: number): DecisionOption[] {
    this.syncEngineeringSnapshot(currentMET);
    const options = this.optionGenerator.generateOptions(this.evidenceManager, currentMET);
    const snapshot = this.evidenceManager.getEngineeringSnapshot();

    for (const opt of options) {
      opt.validationResult = this.validator.validate(
        opt,
        snapshot,
        this.objectiveEvaluator,
        currentMET
      );
      const activeRecord = this.authorizationEngine.getRecord(opt.id);
      if (activeRecord) {
        activeRecord.option.validationResult = opt.validationResult;
      }
    }

    const activeRecords = this.historyTracker.getAllRecords();
    const activeOrResolvedIds = new Set(activeRecords.map((r) => r.decisionId));
    const activeOrResolvedCategories = new Set(
      activeRecords
        .filter((r) => r.status === 'PROPOSED' || r.status === 'APPROVED' || r.status === 'EXECUTED')
        .map((r) => r.option.category)
    );

    return options.filter((opt) => {
      if (activeOrResolvedIds.has(opt.id)) return false;
      if (opt.category === 'LAUNCH_AUTHORIZATION' && activeOrResolvedCategories.has('LAUNCH_AUTHORIZATION')) {
        return false;
      }
      return true;
    });
  }

  /**
   * Proposes a decision option, registering it in authorization lifecycle.
   */
  public proposeDecision(option: DecisionOption, currentMET: number): DecisionRecord {
    const record = this.authorizationEngine.propose(option, currentMET);
    this.historyTracker.archiveRecord(record);
    return record;
  }

  /**
   * Commander authorization (APPROVE or REJECT).
   */
  public authorizeDecision(
    decisionId: string,
    approved: boolean,
    reason: string,
    currentMET: number,
    options?: { bypassFeasibilityCheck?: boolean }
  ): DecisionRecord {
    const record = this.authorizationEngine.authorize(decisionId, approved, reason, currentMET, options);
    this.historyTracker.archiveRecord(record);
    return record;
  }

  /**
   * Executes an approved decision through the flight computer and avionics.
   */
  public async executeDecision(decisionId: string, currentMET: number): Promise<DecisionExecutionResult> {
    this.syncEngineeringSnapshot(currentMET);
    const result = await this.executor.executeDecision(decisionId, currentMET);
    const record = this.authorizationEngine.getRecord(decisionId);
    if (record) {
      this.historyTracker.archiveRecord(record);
    }
    return result;
  }

  /**
   * Advances decision engine time step, evaluating objective deadlines and option expirations.
   */
  public step(_deltaSeconds: number, currentMET: number): void {
    this.syncEngineeringSnapshot(currentMET);
    this.objectiveEvaluator.evaluateAllObjectives(this.evidenceManager, currentMET);

    // Check expiration on proposed decisions
    for (const record of this.authorizationEngine.getAllRecords()) {
      if (
        record.status === 'PROPOSED' &&
        record.option.expirationMET !== undefined &&
        currentMET > record.option.expirationMET
      ) {
        this.authorizationEngine.markExpired(record.decisionId, currentMET);
        this.historyTracker.archiveRecord(record);
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Component Accessors                                                        */
  /* -------------------------------------------------------------------------- */

  public getEvidenceManager(): DecisionEvidenceManager {
    return this.evidenceManager;
  }

  public getObjectiveEvaluator(): MissionObjectiveEvaluator {
    return this.objectiveEvaluator;
  }

  public getRiskEngine(): RiskAssessmentEngine {
    return this.riskEngine;
  }

  public getOptionGenerator(): DecisionOptionGenerator {
    return this.optionGenerator;
  }

  public getValidator(): DecisionValidator {
    return this.validator;
  }

  public getAuthorizationEngine(): DecisionAuthorizationEngine {
    return this.authorizationEngine;
  }

  public getConsequenceEngine(): MissionConsequenceEngine {
    return this.consequenceEngine;
  }

  public getExecutor(): DecisionExecutor {
    return this.executor;
  }

  public getHistoryTracker(): DecisionHistoryTracker {
    return this.historyTracker;
  }

  public getScienceManager(): ScienceProcessingManager | undefined {
    return this.scienceManager;
  }

  public getEventEngine(): MissionEventEngine | undefined {
    return this.eventEngine;
  }
}
