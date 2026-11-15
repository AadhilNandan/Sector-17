/**
 * SECTOR 17 — Science Instrument Registry
 * Maintains instrument configurations, operational modes, power consumption,
 * and versioned calibration profiles for REASON and MASPEX.
 */

import type { InstrumentType, CalibrationProfile } from './types';
import {
  DEFAULT_REASON_CALIBRATION_PROFILE,
  DEFAULT_MASPEX_CALIBRATION_PROFILE,
} from './constants';

export type InstrumentOperationalMode = 'OFF' | 'STANDBY' | 'SURVEY' | 'HIGH_RESOLUTION' | 'FAULT';

export interface InstrumentSpec {
  id: InstrumentType;
  fullName: string;
  category: 'ICE_RADAR' | 'MASS_SPECTROMETER';
  powerWattsByMode: Record<InstrumentOperationalMode, number>;
  dataRateBytesPerSecByMode: Record<InstrumentOperationalMode, number>;
  defaultPacketSizeBytes: number;
  description: string;
}

export const INSTRUMENT_SPECS: Record<InstrumentType, InstrumentSpec> = {
  REASON: {
    id: 'REASON',
    fullName: 'Radar for Europa Assessment and Sounding: Ocean to Near-surface',
    category: 'ICE_RADAR',
    powerWattsByMode: {
      OFF: 0.0,
      STANDBY: 8.0,
      SURVEY: 35.0,
      HIGH_RESOLUTION: 55.0,
      FAULT: 2.0,
    },
    dataRateBytesPerSecByMode: {
      OFF: 0,
      STANDBY: 0,
      SURVEY: 4000,
      HIGH_RESOLUTION: 16000,
      FAULT: 0,
    },
    defaultPacketSizeBytes: 8192,
    description: 'Dual-frequency (9 MHz HF / 60 MHz VHF) ice-penetrating radar profiling Europa ice shell and subsurface structures.',
  },
  MASPEX: {
    id: 'MASPEX',
    fullName: 'MAss SPectrometer for Planetary EXploration',
    category: 'MASS_SPECTROMETER',
    powerWattsByMode: {
      OFF: 0.0,
      STANDBY: 12.0,
      SURVEY: 45.0,
      HIGH_RESOLUTION: 75.0,
      FAULT: 3.0,
    },
    dataRateBytesPerSecByMode: {
      OFF: 0,
      STANDBY: 0,
      SURVEY: 6000,
      HIGH_RESOLUTION: 24000,
      FAULT: 0,
    },
    defaultPacketSizeBytes: 12288,
    description: 'High-resolution time-of-flight mass spectrometer analyzing atmospheric and plume-derived volatiles and organics.',
  },
};

export class InstrumentRegistry {
  private calibrationProfiles: Map<string, CalibrationProfile> = new Map();
  private activeProfileByInstrument: Map<InstrumentType, string> = new Map();
  private instrumentModes: Map<InstrumentType, InstrumentOperationalMode> = new Map();

  constructor() {
    // Register default profiles
    this.registerCalibrationProfile(DEFAULT_REASON_CALIBRATION_PROFILE);
    this.registerCalibrationProfile(DEFAULT_MASPEX_CALIBRATION_PROFILE);
    this.setActiveProfile('REASON', DEFAULT_REASON_CALIBRATION_PROFILE.version);
    this.setActiveProfile('MASPEX', DEFAULT_MASPEX_CALIBRATION_PROFILE.version);

    // Initial operational modes
    this.instrumentModes.set('REASON', 'OFF');
    this.instrumentModes.set('MASPEX', 'OFF');
  }

  public getSpec(instrument: InstrumentType): InstrumentSpec {
    return INSTRUMENT_SPECS[instrument];
  }

  public registerCalibrationProfile(profile: CalibrationProfile): void {
    if (!profile || !profile.version || !profile.instrument) {
      throw new TypeError('registerCalibrationProfile: Invalid calibration profile.');
    }
    this.calibrationProfiles.set(profile.version, { ...profile });
  }

  public getCalibrationProfile(version: string): CalibrationProfile | undefined {
    const p = this.calibrationProfiles.get(version);
    return p ? { ...p } : undefined;
  }

  public setActiveProfile(instrument: InstrumentType, version: string): void {
    const profile = this.calibrationProfiles.get(version);
    if (!profile) {
      throw new Error(`setActiveProfile: Calibration profile '${version}' is not registered.`);
    }
    if (profile.instrument !== instrument) {
      throw new Error(`setActiveProfile: Profile '${version}' is for instrument '${profile.instrument}', not '${instrument}'.`);
    }
    this.activeProfileByInstrument.set(instrument, version);
  }

  public getActiveProfile(instrument: InstrumentType): CalibrationProfile | undefined {
    const version = this.activeProfileByInstrument.get(instrument);
    if (!version) return undefined;
    return this.getCalibrationProfile(version);
  }

  public setMode(instrument: InstrumentType, mode: InstrumentOperationalMode): void {
    this.instrumentModes.set(instrument, mode);
  }

  public getMode(instrument: InstrumentType): InstrumentOperationalMode {
    return this.instrumentModes.get(instrument) ?? 'OFF';
  }

  public isInstrumentActive(instrument: InstrumentType): boolean {
    const mode = this.getMode(instrument);
    return mode === 'SURVEY' || mode === 'HIGH_RESOLUTION';
  }

  public getTotalSciencePowerWatts(): number {
    let total = 0;
    for (const [inst, mode] of this.instrumentModes.entries()) {
      const spec = INSTRUMENT_SPECS[inst];
      if (spec) {
        total += spec.powerWattsByMode[mode] || 0;
      }
    }
    return total;
  }
}

