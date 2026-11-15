import { describe, it, expect } from 'vitest';
import {
  calculateThermalEquilibrium,
  calculateSolarFlux,
  calculateRadiatedPower,
} from '../src/simulation/engineering/thermalModel';
import {
  SOLAR_CONSTANT_1AU,
  STEFAN_BOLTZMANN_CONSTANT,
  DEEP_SPACE_TEMPERATURE_KELVIN,
  CELSIUS_KELVIN_OFFSET,
} from '../src/simulation/constants';
import type { ThermalModelInput } from '../src/simulation/types';

describe('Single-Node Thermal Equilibrium Model', () => {
  describe('Solar Irradiance Flux', () => {
    it('returns exact solar constant of 1361 W/m² at 1 AU', () => {
      expect(calculateSolarFlux(1.0)).toBe(SOLAR_CONSTANT_1AU);
      expect(calculateSolarFlux(1.0)).toBe(1361.0);
    });

    it('scales by inverse-square law at 5.2 AU (Jupiter)', () => {
      // 1361 / (5.2)^2 = 1361 / 27.04 ~ 50.3328 W/m²
      const flux52 = calculateSolarFlux(5.2);
      expect(flux52).toBeCloseTo(1361 / 27.04, 3);
      expect(flux52).toBeCloseTo(50.33, 1);
    });

    it('rejects zero or negative distance', () => {
      expect(() => calculateSolarFlux(0)).toThrow(RangeError);
      expect(() => calculateSolarFlux(-1)).toThrow(RangeError);
      expect(() => calculateSolarFlux(NaN)).toThrow(RangeError);
    });
  });

  describe('Stefan-Boltzmann Radiation', () => {
    it('calculates thermal radiation to deep space', () => {
      // P = epsilon * sigma * A * (T^4 - T_space^4)
      const epsilon = 0.85;
      const area = 10.0; // 10 m²
      const tempK = 300.0;
      const rad = calculateRadiatedPower(epsilon, area, tempK, DEEP_SPACE_TEMPERATURE_KELVIN);

      const expected =
        epsilon *
        STEFAN_BOLTZMANN_CONSTANT *
        area *
        (Math.pow(300, 4) - Math.pow(DEEP_SPACE_TEMPERATURE_KELVIN, 4));

      expect(rad).toBeCloseTo(expected, 4);
      expect(rad).toBeGreaterThan(0);
    });

    it('rejects invalid emissivity, negative area, or negative temperature', () => {
      expect(() => calculateRadiatedPower(0, 5, 300)).toThrow(RangeError);
      expect(() => calculateRadiatedPower(1.2, 5, 300)).toThrow(RangeError);
      expect(() => calculateRadiatedPower(0.8, -5, 300)).toThrow(RangeError);
      expect(() => calculateRadiatedPower(0.8, 5, -10)).toThrow(RangeError);
    });
  });

  describe('Equilibrium Temperature Solver', () => {
    it('solves for valid equilibrium temperature at 1 AU', () => {
      const input: ThermalModelInput = {
        solarAbsorptivity: 0.2, // MLI / white paint
        projectedAreaM2: 2.0, // 2 m² projected to sun
        surfaceEmissivity: 0.8, // high infrared emissivity
        radiatingAreaM2: 8.0, // 8 m² total radiating surface
        distanceAu: 1.0,
        internalHeatDissipationWatts: 300, // 300 W avionics heat
      };

      const result = calculateThermalEquilibrium(input);

      // P_solar_abs = 0.2 * 2.0 * 1361 = 544.4 W
      // P_in = 544.4 + 300 = 844.4 W
      // Radiated: 0.8 * 5.67037e-8 * 8.0 * (T^4 - 2.7255^4) = 844.4 W
      // T^4 ~ 844.4 / (3.629e-7) ~ 2.3267e9 -> T ~ 219.7 K (-53.4°C)
      expect(result.converged).toBe(true);
      expect(result.solarAbsorbedPowerWatts).toBeCloseTo(544.4, 1);
      expect(result.totalThermalInWatts).toBeCloseTo(844.4, 1);
      expect(result.radiatedPowerWatts).toBeCloseTo(844.4, 0);

      // Analytical check: T = (T_space^4 + P_in / (eps * sigma * A))^0.25
      const expectedT = Math.pow(
        Math.pow(DEEP_SPACE_TEMPERATURE_KELVIN, 4) +
          844.4 / (0.8 * STEFAN_BOLTZMANN_CONSTANT * 8.0),
        0.25
      );
      expect(result.equilibriumTemperatureKelvin).toBeCloseTo(expectedT, 2);
      expect(result.equilibriumTemperatureCelsius).toBeCloseTo(expectedT - CELSIUS_KELVIN_OFFSET, 2);
    });

    it('demonstrates solar heating difference between 1 AU and 5.2 AU', () => {
      const baseInput = {
        solarAbsorptivity: 0.5,
        projectedAreaM2: 5.0,
        surfaceEmissivity: 0.8,
        radiatingAreaM2: 10.0,
        internalHeatDissipationWatts: 200,
      };

      const innerSystem = calculateThermalEquilibrium({ ...baseInput, distanceAu: 1.0 });
      const outerSystem = calculateThermalEquilibrium({ ...baseInput, distanceAu: 5.2 });

      // Solar absorbed power at 1 AU is 27.04 times greater than at 5.2 AU
      expect(innerSystem.solarAbsorbedPowerWatts).toBeCloseTo(
        outerSystem.solarAbsorbedPowerWatts * (5.2 * 5.2),
        1
      );

      // Temperature at 1 AU must be substantially higher than at 5.2 AU
      expect(innerSystem.equilibriumTemperatureKelvin).toBeGreaterThan(
        outerSystem.equilibriumTemperatureKelvin
      );
    });

    it('demonstrates the physical effect of emissivity', () => {
      // Lower emissivity reduces radiation ability, raising equilibrium temperature
      const lowEmissivity = calculateThermalEquilibrium({
        solarAbsorptivity: 0.5,
        projectedAreaM2: 2.0,
        surfaceEmissivity: 0.2, // polished gold / low emissivity
        radiatingAreaM2: 5.0,
        distanceAu: 1.0,
        internalHeatDissipationWatts: 200,
      });

      const highEmissivity = calculateThermalEquilibrium({
        solarAbsorptivity: 0.5,
        projectedAreaM2: 2.0,
        surfaceEmissivity: 0.9, // black paint / high emissivity
        radiatingAreaM2: 5.0,
        distanceAu: 1.0,
        internalHeatDissipationWatts: 200,
      });

      expect(lowEmissivity.equilibriumTemperatureKelvin).toBeGreaterThan(
        highEmissivity.equilibriumTemperatureKelvin
      );
    });

    it('demonstrates the physical effect of radiating area', () => {
      // Larger radiating area dissipates heat better, reducing temperature
      const smallRadiator = calculateThermalEquilibrium({
        solarAbsorptivity: 0.3,
        projectedAreaM2: 2.0,
        surfaceEmissivity: 0.8,
        radiatingAreaM2: 2.0, // 2 m²
        distanceAu: 1.0,
        internalHeatDissipationWatts: 400,
      });

      const largeRadiator = calculateThermalEquilibrium({
        solarAbsorptivity: 0.3,
        projectedAreaM2: 2.0,
        surfaceEmissivity: 0.8,
        radiatingAreaM2: 12.0, // 12 m²
        distanceAu: 1.0,
        internalHeatDissipationWatts: 400,
      });

      expect(smallRadiator.equilibriumTemperatureKelvin).toBeGreaterThan(
        largeRadiator.equilibriumTemperatureKelvin
      );
    });

    it('accounts for internal electrical heat dissipation', () => {
      const withoutHeat = calculateThermalEquilibrium({
        solarAbsorptivity: 0.3,
        projectedAreaM2: 2.0,
        surfaceEmissivity: 0.8,
        radiatingAreaM2: 6.0,
        distanceAu: 5.2, // Deep space, low solar flux
        internalHeatDissipationWatts: 0,
      });

      const withHeat = calculateThermalEquilibrium({
        solarAbsorptivity: 0.3,
        projectedAreaM2: 2.0,
        surfaceEmissivity: 0.8,
        radiatingAreaM2: 6.0,
        distanceAu: 5.2,
        internalHeatDissipationWatts: 1500, // 1.5 kW avionics dissipation
      });

      expect(withHeat.equilibriumTemperatureKelvin).toBeGreaterThan(
        withoutHeat.equilibriumTemperatureKelvin
      );
    });
  });

  describe('Thermal Operating Limits & Boundary Rejection', () => {
    it('detects OVERHEATING when equilibrium temperature exceeds limit', () => {
      const result = calculateThermalEquilibrium({
        solarAbsorptivity: 0.9, // High absorption
        projectedAreaM2: 10.0, // Large solar exposure
        surfaceEmissivity: 0.2, // Poor radiator
        radiatingAreaM2: 2.0,
        distanceAu: 0.5, // Close to Sun (e.g. Venus distance)
        maxOperatingTempKelvin: 333.15, // +60°C limit
      });

      expect(result.status).toBe('OVERHEATING');
      expect(result.isWithinOperatingLimits).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum operating limit'))).toBe(true);
    });

    it('detects UNDERCOOLING when equilibrium temperature drops below limit', () => {
      const result = calculateThermalEquilibrium({
        solarAbsorptivity: 0.1,
        projectedAreaM2: 1.0,
        surfaceEmissivity: 0.9,
        radiatingAreaM2: 20.0,
        distanceAu: 5.2, // Jupiter cold
        internalHeatDissipationWatts: 0,
        minOperatingTempKelvin: 233.15, // -40°C limit
      });

      expect(result.status).toBe('UNDERCOOLING');
      expect(result.isWithinOperatingLimits).toBe(false);
      expect(result.errors.some((e) => e.includes('falls below minimum operating limit'))).toBe(true);
    });

    it('rejects invalid physical inputs (absorptivity > 1, negative areas)', () => {
      expect(() =>
        calculateThermalEquilibrium({
          solarAbsorptivity: 1.5, // impossible
          projectedAreaM2: 2.0,
          surfaceEmissivity: 0.8,
          radiatingAreaM2: 4.0,
          distanceAu: 1.0,
        })
      ).toThrow(RangeError);

      expect(() =>
        calculateThermalEquilibrium({
          solarAbsorptivity: 0.5,
          projectedAreaM2: -2.0, // negative area
          surfaceEmissivity: 0.8,
          radiatingAreaM2: 4.0,
          distanceAu: 1.0,
        })
      ).toThrow(RangeError);
    });
  });
});
