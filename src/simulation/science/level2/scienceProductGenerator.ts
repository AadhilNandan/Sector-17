/**
 * SECTOR 17 — Science Product Generator (Level 2 Coordinator)
 * Coordinates generation of Level 2 science products from validated Level 1 data,
 * enforcing strict data provenance and event dispatching.
 */

import { SCIENCE_EVENT_TYPES } from '../constants';
import { ReasonProcessor } from './reasonProcessor';
import { MaspexProcessor, type MaspexProcessingOptions } from './maspexProcessor';
import type { ScienceDataRegistry } from '../scienceDataRegistry';
import type { MissionEventEngine } from '../../operations/missionEventEngine';
import type {
  Level1Product,
  ScienceProductLevel2,
  ReasonCalibratedData,
  MaspexCalibratedData,
  DielectricModel,
} from '../types';

export class ScienceProductGenerator {
  private registry: ScienceDataRegistry;
  private reasonProcessor: ReasonProcessor;
  private maspexProcessor: MaspexProcessor;
  private eventEngine?: MissionEventEngine;

  constructor(registry: ScienceDataRegistry, eventEngine?: MissionEventEngine) {
    this.registry = registry;
    this.reasonProcessor = new ReasonProcessor();
    this.maspexProcessor = new MaspexProcessor();
    this.eventEngine = eventEngine;
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  /**
   * Generates a derived Level 2 science product from a calibrated Level 1 product.
   */
  public generateLevel2Product(
    level1Id: string,
    currentMET: number,
    options?: {
      dielectricModel?: DielectricModel;
      maspexOptions?: MaspexProcessingOptions;
      location?: { latitudeDeg: number; longitudeDeg: number };
    }
  ): ScienceProductLevel2 {
    const l1 = this.registry.getLevel1(level1Id);
    if (!l1) {
      throw new Error(`generateLevel2Product: Level 1 product '${level1Id}' not found.`);
    }

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-l2-proc-start-${l1.id}-${currentMET}`,
        type: SCIENCE_EVENT_TYPES.LEVEL2_PROCESSING_STARTED,
        scheduledTimeSeconds: currentMET,
        payload: {
          level1Id: l1.id,
          instrument: l1.instrument,
        },
      });
    }

    let l2Product: ScienceProductLevel2;

    if (l1.instrument === 'REASON') {
      l2Product = this.reasonProcessor.processLevel2(
        l1 as Level1Product<ReasonCalibratedData>,
        currentMET,
        options?.dielectricModel
      );
    } else if (l1.instrument === 'MASPEX') {
      l2Product = this.maspexProcessor.processLevel2(
        l1 as Level1Product<MaspexCalibratedData>,
        currentMET,
        options?.maspexOptions
      );
    } else {
      throw new Error(`generateLevel2Product: Unsupported instrument '${l1.instrument}'.`);
    }

    const l0 = this.registry.getLevel0(l1.level0Id);
    if (l0) {
      l2Product.acquisitionMET = l0.acquisitionMET;
    }
    if (options?.location) {
      l2Product.location = options.location;
    }

    const registered = this.registry.registerLevel2(l2Product);

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-l2-done-${registered.id}-${currentMET}`,
        type: SCIENCE_EVENT_TYPES.SCIENCE_PRODUCT_GENERATED,
        scheduledTimeSeconds: currentMET,
        payload: {
          level2Id: registered.id,
          level1Id: l1.id,
          level0PacketId: registered.level0PacketId,
          instrument: registered.instrument,
          sizeBytes: registered.sizeBytes,
        },
      });
    }

    return registered;
  }
}
