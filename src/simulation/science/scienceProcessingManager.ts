/**
 * SECTOR 17 — Science Processing Manager
 * High-level orchestrator connecting Level 0 ingestion, Level 1 calibration,
 * Level 2 derived product generation, and Anomaly Detection.
 *
 * SYSTEM INTEGRATION:
 * - SubsystemManager & SciencePayloadSubsystem: Respects instrument readiness and SAFE_MODE.
 * - OnboardStorage: Manages capacity allocation and memory consumption for raw & derived products.
 * - TelemetryQueue & Communications: Enqueues science products for Earth downlink over DSN passes.
 * - StorageRetentionManager: Synchronizes product retention lifecycle with ground acknowledgement.
 * - MissionEventEngine: Emits typed, deterministic processing milestone events.
 */

import { SCIENCE_EVENT_TYPES } from './constants';
import { InstrumentRegistry } from './instrumentRegistry';
import { ScienceDataRegistry } from './scienceDataRegistry';
import { Level0IngestionEngine } from './level0/level0Ingestion';
import { CalibrationEngine } from './level1/calibrationEngine';
import { ScienceProductGenerator } from './level2/scienceProductGenerator';
import type { MaspexProcessingOptions } from './level2/maspexProcessor';
import { AnomalyDetector, type MultiInstrumentCorrelationOptions } from './anomaly/anomalyDetector';
import { SciencePayloadSubsystem } from './sciencePayloadSubsystem';
import type { MissionEventEngine } from '../operations/missionEventEngine';
import type { OnboardStorage } from '../communications/onboardStorage';
import type { TelemetryQueue } from '../communications/telemetryQueue';
import type { StorageRetentionManager } from '../flightSoftware/storageRetention';
import type {
  InstrumentType,
  Level0Product,
  Level1Product,
  ScienceProductLevel2,
  ScienceAnomalyReport,
  ScienceProcessingConfig,
  ScienceProcessingStatus,
  ReasonRawPayload,
  MaspexRawPayload,
  DielectricModel,
} from './types';
import type { StoragePacket } from '../communications/types';

export class ScienceProcessingManager {
  private registry: ScienceDataRegistry;
  private instrumentRegistry: InstrumentRegistry;
  private ingestionEngine: Level0IngestionEngine;
  private calibrationEngine: CalibrationEngine;
  private productGenerator: ScienceProductGenerator;
  private anomalyDetector: AnomalyDetector;
  private scienceSubsystem: SciencePayloadSubsystem;

  private eventEngine?: MissionEventEngine;
  private storage?: OnboardStorage;
  private telemetryQueue?: TelemetryQueue;
  private retentionManager?: StorageRetentionManager;
  private config: Required<ScienceProcessingConfig>;

  constructor(config: ScienceProcessingConfig = {}) {
    this.registry = new ScienceDataRegistry();
    this.instrumentRegistry = new InstrumentRegistry();
    this.scienceSubsystem = new SciencePayloadSubsystem(this.instrumentRegistry);

    this.ingestionEngine = new Level0IngestionEngine(this.registry);
    this.calibrationEngine = new CalibrationEngine(this.registry, this.instrumentRegistry);
    this.productGenerator = new ScienceProductGenerator(this.registry);
    this.anomalyDetector = new AnomalyDetector();

    this.config = {
      autoProcessLevel1: config.autoProcessLevel1 ?? false,
      autoProcessLevel2: config.autoProcessLevel2 ?? false,
      autoDetectAnomalies: config.autoDetectAnomalies ?? true,
      defaultPermittivityModel: config.defaultPermittivityModel ?? 'COLD_PURE_ICE',
      processingDurationSeconds: config.processingDurationSeconds ?? 5.0,
      maspexTolerancePpm: config.maspexTolerancePpm ?? 50.0,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* Subsystem and Environment Attachment                                       */
  /* -------------------------------------------------------------------------- */

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
    this.ingestionEngine.attachEventEngine(engine);
    this.calibrationEngine.attachEventEngine(engine);
    this.productGenerator.attachEventEngine(engine);
    this.anomalyDetector.attachEventEngine(engine);
  }

  public attachStorage(storage: OnboardStorage): void {
    this.storage = storage;
  }

  public attachTelemetryQueue(queue: TelemetryQueue): void {
    this.telemetryQueue = queue;
  }

  public attachRetentionManager(retention: StorageRetentionManager): void {
    this.retentionManager = retention;
  }

  public getSubsystem(): SciencePayloadSubsystem {
    return this.scienceSubsystem;
  }

  public getDataRegistry(): ScienceDataRegistry {
    return this.registry;
  }

  public getInstrumentRegistry(): InstrumentRegistry {
    return this.instrumentRegistry;
  }

  public getAnomalyDetector(): AnomalyDetector {
    return this.anomalyDetector;
  }

  /* -------------------------------------------------------------------------- */
  /* Observation Acquisition & Level 0 Ingestion                                */
  /* -------------------------------------------------------------------------- */

  /**
   * Executes a science observation, writing raw data to onboard storage and ingesting Level 0.
   *
   * @throws Error if instrument is OFF, FAULT, or spacecraft is in SAFE_MODE.
   * @throws CapacityExceededError if OnboardStorage is full.
   */
  public executeObservation<T = ReasonRawPayload | MaspexRawPayload>(
    instrument: InstrumentType,
    rawPayload: T,
    currentMET: number,
    options: {
      packetId?: string;
      sizeBytes?: number;
      priority?: number;
      queueDownlinkImmediately?: boolean;
    } = {}
  ): {
    level0Product: Level0Product<T>;
    storagePacket?: StoragePacket<T>;
  } {
    // 1. Check subsystem and instrument state
    if (this.scienceSubsystem.getStatus() === 'SAFE') {
      throw new Error(
        `executeObservation: Cannot execute ${instrument} observation while Science Subsystem is in SAFE mode.`
      );
    }

    if (!this.scienceSubsystem.isInstrumentReady(instrument)) {
      throw new Error(
        `executeObservation: Instrument ${instrument} is not ready (current mode: ${this.scienceSubsystem.getInstrumentMode(instrument)}).`
      );
    }

    const defaultSize = this.instrumentRegistry.getSpec(instrument).defaultPacketSizeBytes;
    const sizeBytes = options.sizeBytes ?? defaultSize;
    const packetId = options.packetId ?? `pkt-sci-${instrument.toLowerCase()}-${currentMET}`;
    const priority = options.priority ?? 150; // Higher than standard housekeeping

    // 2. Allocate and store in OnboardStorage if attached
    let storagePacket: StoragePacket<T> | undefined;
    if (this.storage) {
      storagePacket = this.storage.storeData<T>({
        id: packetId,
        category: 'science',
        sizeBytes,
        priority,
        createdAtMETSeconds: currentMET,
        payload: rawPayload,
      });

      if (this.retentionManager) {
        this.retentionManager.trackPacket(packetId, 'science', sizeBytes, currentMET);
      }
    }

    // 3. Ingest into Level 0
    const level0Product = this.ingestionEngine.ingestPacket<T>(
      {
        packetId,
        instrument,
        acquisitionMET: currentMET,
        rawPayload,
        sizeBytes,
        sourceStorageId: storagePacket?.id,
      },
      currentMET
    );

    // 4. Optionally queue for downlink
    if (options.queueDownlinkImmediately && this.telemetryQueue) {
      this.telemetryQueue.enqueue({
        id: packetId,
        category: 'science',
        payload: rawPayload,
        sizeBytes,
        priority,
      });

      if (this.retentionManager) {
        this.retentionManager.recordQueued(packetId);
      }
    }

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-sci-data-rx-${packetId}-${currentMET}`,
        type: SCIENCE_EVENT_TYPES.SCIENCE_DATA_RECEIVED,
        scheduledTimeSeconds: currentMET,
        payload: {
          packetId,
          instrument,
          sizeBytes,
          level0Id: level0Product.id,
        },
      });
    }

    // Auto-pipeline if configured
    if (this.config.autoProcessLevel1 && level0Product.status === 'VALIDATED') {
      const l1 = this.calibrateObservation(level0Product.id, currentMET);
      if (this.config.autoProcessLevel2) {
        this.processDerivedScience(l1.id, currentMET);
      }
    }

    return { level0Product, storagePacket };
  }

  /* -------------------------------------------------------------------------- */
  /* Level 1 Calibration                                                        */
  /* -------------------------------------------------------------------------- */

  public calibrateObservation(
    level0Id: string,
    currentMET: number,
    profileOverride?: string
  ): Level1Product {
    return this.calibrationEngine.calibrateLevel0(level0Id, currentMET, profileOverride);
  }

  /* -------------------------------------------------------------------------- */
  /* Level 2 Derived Product Generation & Anomaly Detection                     */
  /* -------------------------------------------------------------------------- */

  public processDerivedScience(
    level1Id: string,
    currentMET: number,
    options?: {
      dielectricModel?: DielectricModel;
      maspexOptions?: MaspexProcessingOptions;
      location?: { latitudeDeg: number; longitudeDeg: number };
    }
  ): {
    level2Product: ScienceProductLevel2;
    anomalyReport: ScienceAnomalyReport | null;
  } {
    const level2Product = this.productGenerator.generateLevel2Product(level1Id, currentMET, options);

    let anomalyReport: ScienceAnomalyReport | null = null;
    if (this.config.autoDetectAnomalies) {
      anomalyReport = this.anomalyDetector.analyzeProduct(level2Product, currentMET);
    }

    return { level2Product, anomalyReport };
  }

  /**
   * Runs the complete end-to-end processing pipeline from Level 0 to Level 2 and Anomaly Scanning.
   */
  public processCompletePipeline(
    level0Id: string,
    currentMET: number,
    options?: {
      calibrationProfileOverride?: string;
      dielectricModel?: DielectricModel;
      maspexOptions?: MaspexProcessingOptions;
      location?: { latitudeDeg: number; longitudeDeg: number };
    }
  ): {
    level1Product: Level1Product;
    level2Product: ScienceProductLevel2;
    anomalyReport: ScienceAnomalyReport | null;
  } {
    const level1Product = this.calibrateObservation(
      level0Id,
      currentMET,
      options?.calibrationProfileOverride
    );

    const { level2Product, anomalyReport } = this.processDerivedScience(
      level1Product.id,
      currentMET,
      options
    );

    return { level1Product, level2Product, anomalyReport };
  }

  /**
   * Correlates contemporaneously collected REASON and MASPEX Level 2 products.
   */
  public evaluateMultiInstrumentCorrelation(
    reasonL2Id: string,
    maspexL2Id: string,
    currentMET: number,
    options: MultiInstrumentCorrelationOptions = {}
  ): ScienceAnomalyReport | null {
    const reason = this.registry.getLevel2Reason(reasonL2Id);
    if (!reason) {
      throw new Error(`evaluateMultiInstrumentCorrelation: REASON product '${reasonL2Id}' not found.`);
    }

    const maspex = this.registry.getLevel2Maspex(maspexL2Id);
    if (!maspex) {
      throw new Error(`evaluateMultiInstrumentCorrelation: MASPEX product '${maspexL2Id}' not found.`);
    }

    return this.anomalyDetector.evaluateMultiInstrumentCorrelation(reason, maspex, currentMET, {
      registry: this.registry,
      ...options,
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Telemetry Queue Downlink Integration                                       */
  /* -------------------------------------------------------------------------- */

  /**
   * Enqueues an existing Level 2 science product for Earth downlink.
   */
  public queueProductForDownlink(
    productId: string,
    _currentMET?: number,
    priority: number = 180
  ): void {
    if (!this.telemetryQueue) {
      throw new Error('queueProductForDownlink: TelemetryQueue is not attached.');
    }

    const prod = this.registry.getLevel2(productId);
    if (!prod) {
      throw new Error(`queueProductForDownlink: Product '${productId}' not found in registry.`);
    }

    this.telemetryQueue.enqueue({
      id: prod.id,
      category: 'science',
      payload: prod,
      sizeBytes: prod.sizeBytes,
      priority,
    });

    if (this.retentionManager) {
      this.retentionManager.recordQueued(prod.id);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Pipeline Status                                                            */
  /* -------------------------------------------------------------------------- */

  public getStatus(): ScienceProcessingStatus {
    const reasonMode = this.scienceSubsystem.getInstrumentMode('REASON');
    const maspexMode = this.scienceSubsystem.getInstrumentMode('MASPEX');

    const mapMode = (m: string) => {
      if (m === 'SURVEY' || m === 'HIGH_RESOLUTION') return 'ACQUIRING';
      if (m === 'STANDBY') return 'STANDBY';
      if (m === 'FAULT') return 'FAULT';
      return 'OFF';
    };

    return {
      totalLevel0PacketsIngested: this.registry.getAllLevel0().length,
      totalLevel1Calibrated: this.registry.getAllLevel1().length,
      totalLevel2ProductsGenerated: this.registry.getAllLevel2().length,
      totalAnomaliesDetected: this.anomalyDetector.getAllAnomalies().length,
      activeProcessingTasks: 0,
      instrumentStatus: {
        REASON: mapMode(reasonMode),
        MASPEX: mapMode(maspexMode),
      },
    };
  }
}
