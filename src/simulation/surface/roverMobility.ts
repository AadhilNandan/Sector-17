/**
 * SECTOR 17 — Rover Mobility Kinematics & Traverse Execution Engine
 * Validates, executes, and records deterministic rover movement across the Europa surface grid.
 * Enforces energy consumption, wheel wear, heading orientation, and non-mutation on failure.
 */

import { validateMoveFeasibility, getTerrainCell } from './terrainModel';
import type {
  RoverState,
  TerrainCell,
  TraverseValidationResult,
} from './types';

export interface TraverseExecutionResult {
  readonly success: boolean;
  readonly failureReason?: string;
  readonly updatedRover: RoverState;
  readonly energyBurnedJoules: number;
  readonly distanceTraveledMetres: number;
  readonly durationSeconds: number;
  readonly validationReport: TraverseValidationResult;
}

/**
 * Executes a verified single-step traverse to target coordinates.
 * Strictly guarantees zero state mutation if the move is invalid or blocked.
 */
export function executeRoverTraverse(
  grid: readonly (readonly TerrainCell[])[],
  rover: RoverState,
  targetCoords: readonly [number, number]
): TraverseExecutionResult {
  const validation = validateMoveFeasibility(grid, rover, targetCoords);

  if (!validation.isFeasible) {
    return {
      success: false,
      failureReason: validation.reason ?? 'Traverse validation failed.',
      updatedRover: rover, // Unmutated
      energyBurnedJoules: 0,
      distanceTraveledMetres: 0,
      durationSeconds: 0,
      validationReport: validation,
    };
  }

  const [cx, cy] = rover.currentCoords;
  const [tx, ty] = targetCoords;
  const targetCell = getTerrainCell(grid, tx, ty)!;

  // 1. Calculate Heading (0° = North/-Y, 90° = East/+X, 180° = South/+Y, 270° = West/-X)
  const dx = tx - cx;
  const dy = ty - cy;
  let headingDeg = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
  if (headingDeg < 0) headingDeg += 360;

  // 2. Consume Energy (Strict non-negative clamping)
  const newEnergyJoules = Math.max(0, rover.batteryEnergyJoules - validation.energyCostJoules);

  // 3. Mechanical Wear on Wheels from Terrain Roughness & Hazard
  const baseWear = targetCell.roughness > 0.35
    ? (targetCell.roughness - 0.35) * 3.5 * targetCell.hazardLevel
    : 0.1;

  const updatedWheels: [number, number, number, number] = [
    Math.max(0, Math.round((rover.wheelHealthPercents[0] - baseWear * 0.95) * 10) / 10),
    Math.max(0, Math.round((rover.wheelHealthPercents[1] - baseWear * 1.05) * 10) / 10),
    Math.max(0, Math.round((rover.wheelHealthPercents[2] - baseWear * 1.0) * 10) / 10),
    Math.max(0, Math.round((rover.wheelHealthPercents[3] - baseWear * 0.98) * 10) / 10),
  ];

  const avgWheelHealth = Math.round(
    ((updatedWheels[0] + updatedWheels[1] + updatedWheels[2] + updatedWheels[3]) / 4) * 10
  ) / 10;

  const warnings = [...rover.warningHistory];
  if (avgWheelHealth < 50.0 && !warnings.some((w) => w.includes('wheel drive degradation'))) {
    warnings.push(`Mobility alert: wheel drive degradation (${avgWheelHealth}% health remaining).`);
  }

  const updatedRover: RoverState = {
    ...rover,
    currentCoords: [tx, ty],
    headingDeg,
    distanceTraveledMetres: Math.round((rover.distanceTraveledMetres + validation.distanceMetres) * 10) / 10,
    batteryEnergyJoules: newEnergyJoules,
    mobilityHealthPercent: avgWheelHealth,
    wheelHealthPercents: updatedWheels,
    operatingMode: 'IDLE',
    mobilityState: 'READY',
    warningHistory: warnings,
  };

  return {
    success: true,
    updatedRover,
    energyBurnedJoules: validation.energyCostJoules,
    distanceTraveledMetres: validation.distanceMetres,
    durationSeconds: validation.durationSeconds,
    validationReport: validation,
  };
}
