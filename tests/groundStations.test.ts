import { describe, it, expect } from 'vitest';
import {
  createGroundStation,
  isStationAvailableAtMET,
  ILLUSTRATIVE_DSN_GOLDSTONE_70M,
  ILLUSTRATIVE_DSN_MADRID_70M,
  ILLUSTRATIVE_DSN_CANBERRA_70M,
  DEFAULT_ILLUSTRATIVE_STATIONS,
} from '../src/simulation/communications/groundStations';
import type { GroundStation } from '../src/simulation/communications/types';

describe('Ground Stations Model', () => {
  describe('Station Creation and Parameter Validation', () => {
    it('creates a valid custom ground station and freezes it for immutability', () => {
      const station = createGroundStation({
        id: 'CUSTOM-STATION-1',
        name: 'Sector 17 Tracking Facility',
        latitudeDeg: 28.5721, // Cape Canaveral
        longitudeDeg: -80.648,
        altitudeMetres: 3,
        antennaDiameterMetres: 35.0,
        supportedBands: ['X', 'Ka'],
        maxTransmitPowerWatts: 10_000,
        systemNoiseTempKelvin: 25.0,
        minElevationDeg: 12.0,
        operationalAvailability: 0.99,
      });

      expect(station.id).toBe('CUSTOM-STATION-1');
      expect(station.name).toBe('Sector 17 Tracking Facility');
      expect(station.latitudeDeg).toBe(28.5721);
      expect(station.longitudeDeg).toBe(-80.648);
      expect(station.antennaDiameterMetres).toBe(35.0);
      expect(station.supportedBands).toEqual(['X', 'Ka']);
      expect(station.maxTransmitPowerWatts).toBe(10_000);
      expect(station.systemNoiseTempKelvin).toBe(25.0);
      expect(station.minElevationDeg).toBe(12.0);
      expect(station.operationalAvailability).toBe(0.99);

      // Verify deep immutability
      expect(Object.isFrozen(station)).toBe(true);
      expect(() => {
        (station as any).antennaDiameterMetres = 50.0;
      }).toThrow();
    });

    it('rejects invalid geographic coordinates with RangeError', () => {
      const baseConfig = {
        id: 'BAD-STATION',
        name: 'Invalid Coordinates Station',
        antennaDiameterMetres: 34.0,
        supportedBands: ['X'] as const,
        maxTransmitPowerWatts: 5000,
        systemNoiseTempKelvin: 20.0,
        minElevationDeg: 10.0,
        operationalAvailability: 1.0,
      };

      // Latitude > +90°
      expect(() =>
        createGroundStation({ ...baseConfig, latitudeDeg: 95.0, longitudeDeg: 0 })
      ).toThrow(RangeError);

      // Latitude < -90°
      expect(() =>
        createGroundStation({ ...baseConfig, latitudeDeg: -90.1, longitudeDeg: 0 })
      ).toThrow(RangeError);

      // Longitude > +180°
      expect(() =>
        createGroundStation({ ...baseConfig, latitudeDeg: 0, longitudeDeg: 180.5 })
      ).toThrow(RangeError);

      // Longitude < -180°
      expect(() =>
        createGroundStation({ ...baseConfig, latitudeDeg: 0, longitudeDeg: -181 })
      ).toThrow(RangeError);
    });

    it('rejects invalid antenna diameter, power, or noise temperature', () => {
      const valid = {
        id: 'TEST',
        name: 'Test',
        latitudeDeg: 0,
        longitudeDeg: 0,
        supportedBands: ['X'] as const,
        minElevationDeg: 10,
        operationalAvailability: 1.0,
      };

      // Zero or negative antenna diameter
      expect(() =>
        createGroundStation({ ...valid, antennaDiameterMetres: 0, maxTransmitPowerWatts: 1000, systemNoiseTempKelvin: 20 })
      ).toThrow(RangeError);

      expect(() =>
        createGroundStation({ ...valid, antennaDiameterMetres: -15, maxTransmitPowerWatts: 1000, systemNoiseTempKelvin: 20 })
      ).toThrow(RangeError);

      // Negative transmit power
      expect(() =>
        createGroundStation({ ...valid, antennaDiameterMetres: 34, maxTransmitPowerWatts: -50, systemNoiseTempKelvin: 20 })
      ).toThrow(RangeError);

      // Zero or negative noise temperature
      expect(() =>
        createGroundStation({ ...valid, antennaDiameterMetres: 34, maxTransmitPowerWatts: 1000, systemNoiseTempKelvin: 0 })
      ).toThrow(RangeError);

      expect(() =>
        createGroundStation({ ...valid, antennaDiameterMetres: 34, maxTransmitPowerWatts: 1000, systemNoiseTempKelvin: -5 })
      ).toThrow(RangeError);
    });

    it('rejects invalid frequency bands or empty band arrays', () => {
      const valid = {
        id: 'TEST',
        name: 'Test',
        latitudeDeg: 0,
        longitudeDeg: 0,
        antennaDiameterMetres: 34,
        maxTransmitPowerWatts: 1000,
        systemNoiseTempKelvin: 20,
        minElevationDeg: 10,
        operationalAvailability: 1.0,
      };

      expect(() =>
        createGroundStation({ ...valid, supportedBands: [] as any })
      ).toThrow(TypeError);

      expect(() =>
        createGroundStation({ ...valid, supportedBands: ['UHF'] as any })
      ).toThrow(TypeError);
    });
  });

  describe('Illustrative Deep Space Network (DSN) Complexes', () => {
    it('provides Goldstone, Madrid, and Canberra stations labeled as illustrative', () => {
      expect(ILLUSTRATIVE_DSN_GOLDSTONE_70M.isIllustrative).toBe(true);
      expect(ILLUSTRATIVE_DSN_MADRID_70M.isIllustrative).toBe(true);
      expect(ILLUSTRATIVE_DSN_CANBERRA_70M.isIllustrative).toBe(true);

      expect(DEFAULT_ILLUSTRATIVE_STATIONS).toHaveLength(3);
      expect(DEFAULT_ILLUSTRATIVE_STATIONS.map((s) => s.id)).toEqual([
        'DSN-GOLDSTONE-70M',
        'DSN-MADRID-70M',
        'DSN-CANBERRA-70M',
      ]);
    });

    it('verifies 120-degree longitudinal separation across the tripartite DSN', () => {
      // Goldstone ~ -117°, Madrid ~ -4°, Canberra ~ +149°
      // Madrid - Goldstone = -4 - (-117) = 113° (~120°)
      // Canberra - Madrid = 149 - (-4) = 153° (~120-150°)
      // (360 + Goldstone) - Canberra = (360 - 117) - 149 = 243 - 149 = 94° (~100-120°)
      const goldstoneLon = ILLUSTRATIVE_DSN_GOLDSTONE_70M.longitudeDeg;
      const madridLon = ILLUSTRATIVE_DSN_MADRID_70M.longitudeDeg;
      const canberraLon = ILLUSTRATIVE_DSN_CANBERRA_70M.longitudeDeg;

      expect(madridLon - goldstoneLon).toBeGreaterThan(100);
      expect(madridLon - goldstoneLon).toBeLessThan(130);
      expect(canberraLon - madridLon).toBeGreaterThan(140);
    });
  });

  describe('Station Availability & Maintenance Blackouts', () => {
    it('detects operational availability and maintenance blackout windows', () => {
      const station = createGroundStation({
        id: 'MAINT-STATION',
        name: 'Maintenance Test Station',
        latitudeDeg: 10,
        longitudeDeg: 20,
        antennaDiameterMetres: 34,
        supportedBands: ['X'],
        maxTransmitPowerWatts: 1000,
        systemNoiseTempKelvin: 20,
        minElevationDeg: 10,
        operationalAvailability: 1.0,
        blackouts: [
          { startMETSeconds: 10_000, endMETSeconds: 15_000, reason: 'Klystron tube replacement' },
          { startMETSeconds: 50_000, endMETSeconds: 60_000, reason: 'Antenna bearing lubrication' },
        ],
      });

      // Before first blackout
      expect(isStationAvailableAtMET(station, 5_000)).toBe(true);

      // During first blackout
      expect(isStationAvailableAtMET(station, 10_000)).toBe(false);
      expect(isStationAvailableAtMET(station, 12_500)).toBe(false);
      expect(isStationAvailableAtMET(station, 15_000)).toBe(false);

      // Between blackouts
      expect(isStationAvailableAtMET(station, 30_000)).toBe(true);

      // During second blackout
      expect(isStationAvailableAtMET(station, 55_000)).toBe(false);

      // After all blackouts
      expect(isStationAvailableAtMET(station, 70_000)).toBe(true);
    });
  });
});
