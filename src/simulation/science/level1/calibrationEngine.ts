/**
 * SECTOR 17 — Science Calibration Engine (Level 1)
 * Transforms raw Level 0 instrument telemetry into calibrated Level 1 data
 * according to versioned, instrument-specific calibration profiles.
 *
 * SAFETY INVARIANTS:
 * 1. Missing calibration profile safety: A missing or invalid profile strictly throws
 *    an error or yields an explicit failure, never false success.
 * 2. Level 0 Immutability: Level 0 raw data is preserved unmutated so recalibration
 *    with updated profiles can be performed at any time.
 * 3. Provenance tracking: Every Level 1 product retains an explicit link to its Level 0 source.
 */

import { SCIENCE_EVENT_TYPES } from '../constants';
import { processRadarNoiseReduction, processMaspexNoiseReduction } from './noiseReduction';
import { assessDataQuality } from './qualityAssessment';
import type { InstrumentRegistry } from '../instrumentRegistry';
import type { ScienceDataRegistry } from '../scienceDataRegistry';
import type { MissionEventEngine } from '../../operations/missionEventEngine';
import type {
  Level0Product,
  Level1Product,
  ReasonRawPayload,
  MaspexRawPayload,
  ReasonCalibratedData,
  MaspexCalibratedData,
  MaspexDetectedPeak,
  CalibrationProfile,
} from '../types';

export class MissingCalibrationProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingCalibrationProfileError';
  }
}

export class CalibrationEngine {
  private registry: ScienceDataRegistry;
  private instrumentRegistry: InstrumentRegistry;
  private eventEngine?: MissionEventEngine;

  constructor(
    registry: ScienceDataRegistry,
    instrumentRegistry: InstrumentRegistry,
    eventEngine?: MissionEventEngine
  ) {
    this.registry = registry;
    this.instrumentRegistry = instrumentRegistry;
    this.eventEngine = eventEngine;
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  /**
   * Calibrates a Level 0 product into a Level 1 product using the active or specified calibration profile.
   */
  public calibrateLevel0(
    level0Id: string,
    currentMET: number,
    profileVersionOverride?: string
  ): Level1Product {
    const l0 = this.registry.getLevel0(level0Id);
    if (!l0) {
      throw new Error(`calibrateLevel0: Level 0 product '${level0Id}' not found.`);
    }

    if (l0.status !== 'VALIDATED') {
      throw new Error(`calibrateLevel0: Cannot calibrate Level 0 product '${level0Id}' with status '${l0.status}'.`);
    }

    // Determine calibration profile
    let profile: CalibrationProfile | undefined;
    if (profileVersionOverride) {
      profile = this.instrumentRegistry.getCalibrationProfile(profileVersionOverride);
      if (!profile) {
        throw new MissingCalibrationProfileError(
          `calibrateLevel0: Specified calibration profile '${profileVersionOverride}' not found.`
        );
      }
    } else {
      if (l0.instrument !== 'REASON' && l0.instrument !== 'MASPEX') {
        throw new MissingCalibrationProfileError(
          `calibrateLevel0: No active calibration profile registered for surface/external instrument '${l0.instrument}'.`
        );
      }
      profile = this.instrumentRegistry.getActiveProfile(l0.instrument);
      if (!profile) {
        throw new MissingCalibrationProfileError(
          `calibrateLevel0: No active calibration profile registered for instrument '${l0.instrument}'.`
        );
      }
    }

    if (profile.instrument !== l0.instrument) {
      throw new Error(
        `calibrateLevel0: Profile '${profile.version}' belongs to '${profile.instrument}', not '${l0.instrument}'.`
      );
    }

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-cal-start-${l0.id}-${currentMET}`,
        type: SCIENCE_EVENT_TYPES.LEVEL1_CALIBRATION_STARTED,
        scheduledTimeSeconds: currentMET,
        payload: {
          level0Id: l0.id,
          instrument: l0.instrument,
          profileVersion: profile.version,
        },
      });
    }

    if (l0.instrument === 'REASON') {
      return this.calibrateReason(l0 as Level0Product<ReasonRawPayload>, profile, currentMET);
    } else if (l0.instrument === 'MASPEX') {
      return this.calibrateMaspex(l0 as Level0Product<MaspexRawPayload>, profile, currentMET);
    } else {
      throw new Error(`calibrateLevel0: Unsupported instrument '${l0.instrument}'.`);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* REASON Radar Calibration                                                   */
  /* -------------------------------------------------------------------------- */

  private calibrateReason(
    l0: Level0Product<ReasonRawPayload>,
    profile: CalibrationProfile,
    currentMET: number
  ): Level1Product<ReasonCalibratedData> {
    const raw = l0.rawPayload;
    const samples = raw.echoSamples;
    const dt = raw.samplingIntervalSeconds;

    // 1. Apply baseline subtraction and gain
    const gainCorrected: number[] = new Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const offsetSubtracted = Math.max(0, samples[i] - profile.baselineOffset);
      gainCorrected[i] = offsetSubtracted * profile.gainMultiplier;
    }

    // 2. Compute noise floor and SNR
    const noiseRes = processRadarNoiseReduction(gainCorrected, profile.noiseThreshold);

    // 3. Build time bins
    const timeBinsSeconds = new Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      timeBinsSeconds[i] = i * dt;
    }

    const saturationDetected = noiseRes.peakSignal >= 0.98;

    // 4. Quality flags
    const qualityFlags = assessDataQuality({
      instrument: 'REASON',
      peakValue: noiseRes.peakSignal,
      snrDb: noiseRes.snrDb,
      baselineOffsetRemoved: profile.baselineOffset,
      calibrationProfile: profile,
    });

    const calibratedData: ReasonCalibratedData = {
      calibratedEchoes: noiseRes.cleanedSamples,
      timeBinsSeconds,
      samplingIntervalSeconds: dt,
      baselineNoiseFloor: noiseRes.baselineNoiseFloor,
      peakSnrDb: noiseRes.snrDb,
      saturationDetected,
    };

    const id = `l1-reason-${l0.packetId}`;
    const l1Product: Level1Product<ReasonCalibratedData> = {
      id,
      level0Id: l0.id,
      packetId: l0.packetId,
      instrument: 'REASON',
      calibrationProfileVersion: profile.version,
      processingMET: currentMET,
      sizeBytes: Math.floor(l0.sizeBytes * 1.1), // includes calibration headers
      calibratedData,
      qualityFlags,
      snrDb: noiseRes.snrDb,
      baselineOffsetRemoved: profile.baselineOffset,
      gainApplied: profile.gainMultiplier,
    };

    const registered = this.registry.registerLevel1(l1Product as unknown as Level1Product) as Level1Product<ReasonCalibratedData>;

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-cal-done-${id}-${currentMET}`,
        type: SCIENCE_EVENT_TYPES.LEVEL1_CALIBRATION_COMPLETED,
        scheduledTimeSeconds: currentMET,
        payload: {
          level1Id: id,
          level0Id: l0.id,
          instrument: 'REASON',
          snrDb: noiseRes.snrDb,
          qualityFlags,
        },
      });
    }

    return registered;
  }

  /* -------------------------------------------------------------------------- */
  /* MASPEX Mass Spectrometer Calibration                                       */
  /* -------------------------------------------------------------------------- */

  private calibrateMaspex(
    l0: Level0Product<MaspexRawPayload>,
    profile: CalibrationProfile,
    currentMET: number
  ): Level1Product<MaspexCalibratedData> {
    const raw = l0.rawPayload;
    const samples = raw.mzSamples;

    // Polynomial mass axis correction: mz_cal = a1 * mz + a0
    const [a0, a1] =
      profile.axisCalibrationPolynomial && profile.axisCalibrationPolynomial.length === 2
        ? profile.axisCalibrationPolynomial
        : [0.0, 1.0];

    const rawIntensities = samples.map((s) => s.intensity);
    const noiseRes = processMaspexNoiseReduction(rawIntensities, profile.noiseThreshold);

    // Apply baseline subtraction, gain, and axis calibration
    const calibratedSpectra: Array<{ mz: number; intensity: number; snr: number }> = [];

    for (let i = 0; i < samples.length; i++) {
      const correctedMz = a1 * samples[i].mz + a0;
      const offsetSubtracted = Math.max(0, samples[i].intensity - profile.baselineOffset);
      const intensity = offsetSubtracted * profile.gainMultiplier;
      const snr = intensity / noiseRes.baselineNoiseFloor;

      calibratedSpectra.push({
        mz: Number(correctedMz.toFixed(4)),
        intensity,
        snr: Number(snr.toFixed(2)),
      });
    }

    // Detect peaks in calibrated spectrum
    const detectedPeaks: MaspexDetectedPeak[] = [];
    const minIntensity = profile.noiseThreshold * 2.0;

    for (let i = 1; i < calibratedSpectra.length - 1; i++) {
      const prev = calibratedSpectra[i - 1].intensity;
      const curr = calibratedSpectra[i].intensity;
      const next = calibratedSpectra[i + 1].intensity;

      if (curr > minIntensity && curr >= prev && curr > next) {
        // FWHM estimate: search left and right for half-maximum
        const halfMax = curr / 2.0;
        let leftMz = calibratedSpectra[i].mz;
        for (let j = i - 1; j >= 0; j--) {
          if (calibratedSpectra[j].intensity <= halfMax) {
            leftMz = calibratedSpectra[j].mz;
            break;
          }
        }
        let rightMz = calibratedSpectra[i].mz;
        for (let j = i + 1; j < calibratedSpectra.length; j++) {
          if (calibratedSpectra[j].intensity <= halfMax) {
            rightMz = calibratedSpectra[j].mz;
            break;
          }
        }

        const fwhm = Math.max(0.005, rightMz - leftMz);
        const resolution = calibratedSpectra[i].mz / fwhm;
        const snr = curr / noiseRes.baselineNoiseFloor;

        detectedPeaks.push({
          mz: calibratedSpectra[i].mz,
          intensity: curr,
          fwhm,
          snr,
          resolution,
        });
      }
    }

    const saturationDetected = noiseRes.peakIntensity >= 65000.0;

    const qualityFlags = assessDataQuality({
      instrument: 'MASPEX',
      peakValue: noiseRes.peakIntensity,
      snrDb: noiseRes.snrDb,
      baselineOffsetRemoved: profile.baselineOffset,
      calibrationProfile: profile,
    });

    const averageResolution =
      detectedPeaks.length > 0
        ? detectedPeaks.reduce((sum, p) => sum + p.resolution, 0) / detectedPeaks.length
        : 20000;

    const calibratedData: MaspexCalibratedData = {
      calibratedSpectra,
      detectedPeaks,
      baselineNoiseFloor: noiseRes.baselineNoiseFloor,
      peakCount: detectedPeaks.length,
      saturationDetected,
      resolutionEstimate: averageResolution,
    };

    const id = `l1-maspex-${l0.packetId}`;
    const l1Product: Level1Product<MaspexCalibratedData> = {
      id,
      level0Id: l0.id,
      packetId: l0.packetId,
      instrument: 'MASPEX',
      calibrationProfileVersion: profile.version,
      processingMET: currentMET,
      sizeBytes: Math.floor(l0.sizeBytes * 1.15),
      calibratedData,
      qualityFlags,
      snrDb: noiseRes.snrDb,
      baselineOffsetRemoved: profile.baselineOffset,
      gainApplied: profile.gainMultiplier,
    };

    const registered = this.registry.registerLevel1(l1Product as unknown as Level1Product) as Level1Product<MaspexCalibratedData>;

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-cal-done-${id}-${currentMET}`,
        type: SCIENCE_EVENT_TYPES.LEVEL1_CALIBRATION_COMPLETED,
        scheduledTimeSeconds: currentMET,
        payload: {
          level1Id: id,
          level0Id: l0.id,
          instrument: 'MASPEX',
          peakCount: detectedPeaks.length,
          snrDb: noiseRes.snrDb,
          qualityFlags,
        },
      });
    }

    return registered;
  }
}

