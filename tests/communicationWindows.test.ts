import { describe, it, expect } from 'vitest';
import {
  calculateStationElevation,
  evaluateStationVisibility,
  findVisibleGroundStations,
  generateCommunicationWindows,
  EARTH_MEAN_RADIUS_METRES,
} from '../src/simulation/communications/communicationWindows';
import {
  ILLUSTRATIVE_DSN_GOLDSTONE_70M,
  ILLUSTRATIVE_DSN_MADRID_70M,
  ILLUSTRATIVE_DSN_CANBERRA_70M,
  createGroundStation,
} from '../src/simulation/communications/groundStations';
import type { SpacecraftPointingTarget } from '../src/simulation/communications/types';

describe('Communication Windows & Visibility Module', () => {
  describe('Geometric Elevation Calculation', () => {
    it('returns 90 degrees elevation when spacecraft is directly at zenith', () => {
      // Station and sub-spacecraft point at identical latitude and longitude
      const elevation = calculateStationElevation(35.0, -116.0, 35.0, -116.0, 1e9);
      expect(elevation).toBeCloseTo(90.0, 5);
    });

    it('returns negative elevation when spacecraft is over the opposite hemisphere', () => {
      // Station in northern hemisphere, subpoint on opposite side of Earth
      const elevation = calculateStationElevation(40.0, 0.0, -40.0, 180.0, 1e9);
      expect(elevation).toBeLessThan(0);
    });

    it('accounts for finite distance geometric horizon vs infinite approximation', () => {
      // Station at equator (0, 0), target at (0, 85)
      // At infinite distance, elevation ~ 90 - 85 = 5°
      const elevationInf = calculateStationElevation(0, 0, 0, 85, 1e12);
      expect(elevationInf).toBeCloseTo(5.0, 1);

      // At low orbit altitude (e.g. 7,000 km geocentric), target at 85° is below horizon
      const elevationLow = calculateStationElevation(0, 0, 0, 85, 7_000_000);
      expect(elevationLow).toBeLessThan(elevationInf);
    });

    it('rejects invalid coordinates and distances below Earth radius', () => {
      expect(() => calculateStationElevation(95, 0, 0, 0)).toThrow(RangeError);
      expect(() => calculateStationElevation(0, -200, 0, 0)).toThrow(RangeError);
      expect(() => calculateStationElevation(0, 0, 0, 0, EARTH_MEAN_RADIUS_METRES - 1000)).toThrow(RangeError);
    });
  });

  describe('Station Visibility Evaluation', () => {
    it('evaluates station as visible when elevation exceeds horizon mask', () => {
      // Subpoint close to Goldstone (35.4° N, -116.9° W)
      const target: SpacecraftPointingTarget = {
        subSpacecraftLatitudeDeg: 35.0,
        subSpacecraftLongitudeDeg: -115.0,
        distanceMetres: 1e11,
      };

      const result = evaluateStationVisibility(ILLUSTRATIVE_DSN_GOLDSTONE_70M, target, 1000);
      expect(result.isVisible).toBe(true);
      expect(result.elevationDeg).toBeGreaterThan(ILLUSTRATIVE_DSN_GOLDSTONE_70M.minElevationDeg);
      expect(result.reason).toBeUndefined();
    });

    it('evaluates station as not visible when below minimum elevation limit', () => {
      // Subpoint far away from Goldstone (near Australia)
      const target: SpacecraftPointingTarget = {
        subSpacecraftLatitudeDeg: -35.0,
        subSpacecraftLongitudeDeg: 140.0,
        distanceMetres: 1e11,
      };

      const result = evaluateStationVisibility(ILLUSTRATIVE_DSN_GOLDSTONE_70M, target, 1000);
      expect(result.isVisible).toBe(false);
      expect(result.elevationDeg).toBeLessThan(ILLUSTRATIVE_DSN_GOLDSTONE_70M.minElevationDeg);
      expect(result.reason).toContain('below station horizon mask');
    });

    it('evaluates station as not visible during maintenance blackout even if geometrically in view', () => {
      const station = createGroundStation({
        id: 'TEST-STATION',
        name: 'Maintenance Station',
        latitudeDeg: 35.0,
        longitudeDeg: -115.0,
        antennaDiameterMetres: 34,
        supportedBands: ['X'],
        maxTransmitPowerWatts: 1000,
        systemNoiseTempKelvin: 20,
        minElevationDeg: 10,
        operationalAvailability: 1.0,
        blackouts: [{ startMETSeconds: 5000, endMETSeconds: 8000, reason: 'Calibration' }],
      });

      const target: SpacecraftPointingTarget = {
        subSpacecraftLatitudeDeg: 35.0,
        subSpacecraftLongitudeDeg: -115.0, // directly overhead!
        distanceMetres: 1e11,
      };

      // At MET = 6000 (inside blackout window)
      const result = evaluateStationVisibility(station, target, 6000);
      expect(result.isVisible).toBe(false);
      expect(result.elevationDeg).toBeGreaterThan(80); // geometrically overhead
      expect(result.reason).toContain('offline for scheduled maintenance');
    });
  });

  describe('Multi-Station Visibility and Opportunity Comparison', () => {
    it('discovers all currently visible stations and sorts them by elevation angle descending', () => {
      const stations = [
        ILLUSTRATIVE_DSN_GOLDSTONE_70M,
        ILLUSTRATIVE_DSN_MADRID_70M,
        ILLUSTRATIVE_DSN_CANBERRA_70M,
      ];

      // Target in Pacific between California and Australia (20° N, -160° W)
      const target: SpacecraftPointingTarget = {
        subSpacecraftLatitudeDeg: 20.0,
        subSpacecraftLongitudeDeg: -160.0,
        distanceMetres: 1e11,
      };

      const visible = findVisibleGroundStations(stations, target, 0);

      // Verify returned stations are sorted by elevation descending
      for (let i = 0; i < visible.length - 1; i++) {
        expect(visible[i].elevationDeg).toBeGreaterThanOrEqual(visible[i + 1].elevationDeg);
      }
    });
  });

  describe('Communication Window Generation Over Time Interval', () => {
    it('generates continuous communication windows and identifies peak elevation', () => {
      const stations = [ILLUSTRATIVE_DSN_GOLDSTONE_70M];

      // Simulated pass: subpoint moves eastward across Goldstone
      // At t = 0: subpoint at -180° (out of view)
      // At t = 3600 (1h): subpoint at -116° (zenith)
      // At t = 7200 (2h): subpoint at -50° (out of view)
      const targetEvaluator = (metSeconds: number): SpacecraftPointingTarget => {
        const fraction = metSeconds / 7200;
        const lon = -180 + fraction * 130;
        return {
          subSpacecraftLatitudeDeg: 35.4,
          subSpacecraftLongitudeDeg: lon,
          distanceMetres: 1e11,
        };
      };

      const windows = generateCommunicationWindows(stations, targetEvaluator, 0, 7200, 300);

      expect(windows.length).toBeGreaterThanOrEqual(1);
      const win = windows[0];
      expect(win.stationId).toBe('DSN-GOLDSTONE-70M');
      expect(win.durationSeconds).toBeGreaterThan(0);
      expect(win.maxElevationDeg).toBeGreaterThan(50);
      expect(win.averageDistanceMetres).toBeCloseTo(1e11, -3);
    });
  });
});
