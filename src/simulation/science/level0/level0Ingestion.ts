/**
 * SECTOR 17 — Level 0 Science Data Ingestion
 * Ingests raw telemetry observation packets into validated, immutable Level 0 products.
 *
 * SAFETY INVARIANTS:
 * 1. Deep raw data preservation: Raw input samples are never mutated or transformed.
 * 2. Explicit failure containment: Malformed or corrupted packets enter REJECTED state with explicit error reasons.
 * 3. Duplicate rejection: Cannot ingest identical packet ID multiple times.
 */

import { SCIENCE_EVENT_TYPES } from '../constants';
import { validateRawPayload } from './rawDataValidation';
import type { MissionEventEngine } from '../../operations/missionEventEngine';
import type { ScienceDataRegistry } from '../scienceDataRegistry';
import type {
  InstrumentType,
  Level0Product,
  ReasonRawPayload,
  MaspexRawPayload,
} from '../types';

export interface IngestionInput<T = ReasonRawPayload | MaspexRawPayload> {
  packetId: string;
  instrument: InstrumentType;
  acquisitionMET: number;
  rawPayload: T;
  sizeBytes?: number;
  sourceStorageId?: string;
}

export class Level0IngestionEngine {
  private registry: ScienceDataRegistry;
  private eventEngine?: MissionEventEngine;

  constructor(registry: ScienceDataRegistry, eventEngine?: MissionEventEngine) {
    this.registry = registry;
    this.eventEngine = eventEngine;
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  /**
   * Ingests a raw telemetry science packet into a Level 0 product.
   */
  public ingestPacket<T = ReasonRawPayload | MaspexRawPayload>(
    input: IngestionInput<T>,
    currentMET: number
  ): Level0Product<T> {
    if (!input || typeof input !== 'object') {
      throw new TypeError('ingestPacket: Input must be an object.');
    }
    if (!input.packetId || typeof input.packetId !== 'string') {
      throw new TypeError('ingestPacket: packetId must be a non-empty string.');
    }
    if (input.instrument !== 'REASON' && input.instrument !== 'MASPEX') {
      throw new TypeError(`ingestPacket: Unsupported instrument '${input.instrument}'.`);
    }

    const packetId = input.packetId.trim();

    // Check duplicate in registry
    const existing = this.registry.getLevel0ByPacketId(packetId);
    if (existing) {
      throw new Error(`ingestPacket: Duplicate ingestion. Packet ID '${packetId}' is already registered.`);
    }

    const id = `l0-${input.instrument.toLowerCase()}-${packetId}`;

    // 1. Initial State: RECEIVED -> VALIDATING
    const validation = validateRawPayload(input.instrument, input.rawPayload);

    const sizeBytes =
      input.sizeBytes ??
      (input.instrument === 'REASON' ? 8192 : 12288);

    if (!validation.isValid) {
      const rejectedProduct: Level0Product<T> = {
        id,
        instrument: input.instrument,
        packetId,
        category: 'science',
        acquisitionMET: input.acquisitionMET,
        ingestionMET: currentMET,
        status: 'REJECTED',
        sizeBytes,
        rawPayload: JSON.parse(JSON.stringify(input.rawPayload)),
        checksumValid: validation.checksumValid,
        validationError: validation.error,
        sourceStorageId: input.sourceStorageId,
      };

      if (this.eventEngine) {
        this.eventEngine.scheduleEvent({
          id: `evt-l0-val-fail-${id}-${currentMET}`,
          type: SCIENCE_EVENT_TYPES.LEVEL0_VALIDATION_FAILED,
          scheduledTimeSeconds: currentMET,
          payload: {
            level0Id: id,
            packetId,
            instrument: input.instrument,
            error: validation.error,
          },
        });
      }

      // We still register rejected product for audit traceability
      return this.registry.registerLevel0(rejectedProduct as unknown as Level0Product) as unknown as Level0Product<T>;
    }

    // 2. Validated State: VALIDATED
    const validatedProduct: Level0Product<T> = {
      id,
      instrument: input.instrument,
      packetId,
      category: 'science',
      acquisitionMET: input.acquisitionMET,
      ingestionMET: currentMET,
      status: 'VALIDATED',
      sizeBytes,
      rawPayload: JSON.parse(JSON.stringify(input.rawPayload)),
      checksumValid: validation.checksumValid,
      sourceStorageId: input.sourceStorageId,
    };

    const registered = this.registry.registerLevel0(validatedProduct as unknown as Level0Product) as unknown as Level0Product<T>;

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-l0-val-success-${id}-${currentMET}`,
        type: SCIENCE_EVENT_TYPES.LEVEL0_VALIDATION_COMPLETED,
        scheduledTimeSeconds: currentMET,
        payload: {
          level0Id: id,
          packetId,
          instrument: input.instrument,
          acquisitionMET: input.acquisitionMET,
          sizeBytes,
        },
      });
    }

    return registered;
  }
}

