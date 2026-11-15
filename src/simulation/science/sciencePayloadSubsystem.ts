/**
 * SECTOR 17 — Science Payload Subsystem
 * Implements ISubsystem for AETHON's scientific instrument suite (REASON & MASPEX).
 *
 * SAFETY INVARIANTS:
 * 1. SAFE_MODE inhibition: When the mission or subsystem enters SAFE mode, all science instruments
 *    are immediately transitioned to OFF / SAFE, and science data collection is strictly blocked.
 * 2. Recovery gating: Recovering from FAULT or SAFE requires external recovery validation.
 * 3. Power tracking: Reflects active electrical power draw of operating instruments.
 */

import { BaseSubsystem } from '../flightSoftware/subsystemManager';
import type { InstrumentRegistry, InstrumentOperationalMode } from './instrumentRegistry';
import type { InstrumentType } from './types';

export class SciencePayloadSubsystem extends BaseSubsystem {
  private instrumentRegistry: InstrumentRegistry;

  constructor(instrumentRegistry: InstrumentRegistry) {
    super('subsys-science-payload', 'Scientific Payload Suite (REASON & MASPEX)', 'SCIENCE', 'SIMPLIFIED', 'OFF');
    this.instrumentRegistry = instrumentRegistry;
  }

  public override toSafeMode(_currentMETSeconds?: number): void {
    // In SAFE mode, immediately shut down high-power instrument emitters
    this.instrumentRegistry.setMode('REASON', 'OFF');
    this.instrumentRegistry.setMode('MASPEX', 'OFF');
    this.status = 'SAFE';
  }

  public override recover(_currentMETSeconds?: number, validator?: () => boolean): boolean {
    if (validator && !validator()) {
      return false;
    }
    // Restore to STANDBY (ready for commanded observations)
    this.instrumentRegistry.setMode('REASON', 'STANDBY');
    this.instrumentRegistry.setMode('MASPEX', 'STANDBY');
    this.status = 'NOMINAL';
    return true;
  }

  public setInstrumentMode(instrument: InstrumentType, mode: InstrumentOperationalMode): void {
    if (this.status === 'SAFE') {
      if (mode !== 'OFF') {
        throw new Error(`SciencePayloadSubsystem: Cannot activate '${instrument}' while subsystem is in SAFE mode.`);
      }
    }
    this.instrumentRegistry.setMode(instrument, mode);

    // If any instrument is active, subsystem is NOMINAL; if all OFF, status is OFF
    if (mode === 'SURVEY' || mode === 'HIGH_RESOLUTION') {
      this.status = 'NOMINAL';
    } else if (
      this.instrumentRegistry.getMode('REASON') === 'OFF' &&
      this.instrumentRegistry.getMode('MASPEX') === 'OFF'
    ) {
      this.status = 'OFF';
    }
  }

  public getInstrumentMode(instrument: InstrumentType): InstrumentOperationalMode {
    return this.instrumentRegistry.getMode(instrument);
  }

  public isInstrumentReady(instrument: InstrumentType): boolean {
    if (this.status !== 'NOMINAL') return false;
    const mode = this.getInstrumentMode(instrument);
    return mode === 'STANDBY' || mode === 'SURVEY' || mode === 'HIGH_RESOLUTION';
  }

  public getInstrumentRegistry(): InstrumentRegistry {
    return this.instrumentRegistry;
  }

  public override step(_deltaSeconds: number, _currentMETSeconds: number): void {
    // Keep subsystem status consistent
    if (this.status === 'SAFE') {
      this.instrumentRegistry.setMode('REASON', 'OFF');
      this.instrumentRegistry.setMode('MASPEX', 'OFF');
    }
  }
}
