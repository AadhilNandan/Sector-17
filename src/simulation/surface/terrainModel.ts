/**
 * SECTOR 17 — Europa Surface Terrain & Topology Simulation
 * Deterministic generation, slope/obstacle mechanics, hazard rating,
 * and traversal feasibility validation for the Conamara / Pelagon Chaos survey grid.
 */

import {
  SURFACE_GRID_WIDTH,
  SURFACE_GRID_HEIGHT,
  TERRAIN_CELL_SIZE_METRES,
  ROVER_NOMINAL_SPEED_MPS,
  ROVER_MAX_TRAVERSABLE_SLOPE_DEG,
  ROVER_MAX_TRAVERSABLE_ROUGHNESS,
  ROVER_MIN_MOBILITY_HEALTH_PERCENT,
  ROVER_POWER_DEMANDS_WATTS,
} from './constants';
import type {
  TerrainCell,
  TraverseValidationResult,
  RoverState,
} from './types';

/**
 * Generates the deterministic 10x10 surface terrain grid around the primary landing site.
 * Coordinates are [x, y] with [4, 4] being the nominal touchdown zone.
 */
export function generateEuropaTerrainGrid(): TerrainCell[][] {
  const grid: TerrainCell[][] = [];

  for (let y = 0; y < SURFACE_GRID_HEIGHT; y++) {
    const row: TerrainCell[] = [];
    for (let x = 0; x < SURFACE_GRID_WIDTH; x++) {
      // Deterministic pseudo-topography based on grid position
      const distFromCenter = Math.sqrt(Math.pow(x - 4, 2) + Math.pow(y - 4, 2));
      const elevationMetres = Math.round((Math.sin(x * 0.8) * 4.0 + Math.cos(y * 0.9) * 3.5 + (x - y) * 0.5) * 10) / 10;
      const slopeDeg = Math.min(28, Math.max(1, Math.round((distFromCenter * 2.2 + ((x * y) % 5)) * 10) / 10));
      const roughness = Math.min(0.9, Math.max(0.08, Math.round((0.15 + distFromCenter * 0.06 + (((x + 2) * (y + 1)) % 7) * 0.04) * 100) / 100));
      const hazardLevel = Math.min(0.95, Math.max(0.05, Math.round((roughness * 0.6 + (slopeDeg / 30) * 0.4) * 100) / 100));
      const traversalDifficulty = Math.round((1.0 + roughness * 0.8 + (slopeDeg / 25) * 0.5) * 100) / 100;
      const scienceInterestValue = Math.min(100, Math.max(10, Math.round((distFromCenter * 8 + ((x * 7 + y * 13) % 40)) * 10) / 10));

      let hasObstacle = false;
      let obstacleType: TerrainCell['obstacleType'];
      let featureName: string | undefined;
      let isAnomalyTarget = false;

      // Primary Landing Zone (x:4, y:4)
      if (x === 4 && y === 4) {
        row.push({
          x,
          y,
          elevationMetres: 0.0,
          slopeDeg: 1.2,
          roughness: 0.12,
          hasObstacle: false,
          traversalDifficulty: 1.0,
          hazardLevel: 0.08,
          scienceInterestValue: 40,
          featureName: 'Pelagon Touchdown Site',
          isSurveyed: true,
        });
        continue;
      }

      // Special Geological Landmarks & Obstacles
      if (x === 2 && y === 7) {
        hasObstacle = true;
        obstacleType = 'ICE_CREVASSE';
        featureName = 'Thera Fractured Crevasse';
      } else if (x === 7 && y === 3) {
        hasObstacle = true;
        obstacleType = 'SERAC_PINNACLE';
        featureName = 'Castalia Serac Pinnacles';
      } else if (x === 1 && y === 2) {
        hasObstacle = true;
        obstacleType = 'BOULDER_PRESSURE_RIDGE';
        featureName = 'Cryo-Block Barrier';
      } else if (x === 8 && y === 8) {
        featureName = 'Cyclopean Pressure Ridge';
      } else if (x === 6 && y === 7) {
        // High-value thermal anomaly target
        featureName = 'Subsurface Cryo-Thermal Vent Anomaly';
        isAnomalyTarget = true;
      } else if (x === 3 && y === 1) {
        featureName = 'Pristine Diapir Ice Dome';
      }

      row.push({
        x,
        y,
        elevationMetres,
        slopeDeg,
        roughness,
        hasObstacle,
        obstacleType,
        traversalDifficulty,
        hazardLevel,
        scienceInterestValue: isAnomalyTarget ? 100 : scienceInterestValue,
        featureName,
        isSurveyed: false,
        isAnomalyTarget,
      });
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Bounds-checked lookup for a cell in the terrain grid.
 */
export function getTerrainCell(
  grid: readonly (readonly TerrainCell[])[],
  x: number,
  y: number
): TerrainCell | undefined {
  if (y < 0 || y >= grid.length) return undefined;
  const row = grid[y];
  if (!row || x < 0 || x >= row.length) return undefined;
  return row[x];
}

/**
 * Validates whether a rover can execute a traverse to target coordinates.
 * Evaluates rover state, battery energy, slope, roughness, obstacles, and mechanical limits.
 */
export function validateMoveFeasibility(
  grid: readonly (readonly TerrainCell[])[],
  rover: RoverState,
  targetCoords: readonly [number, number]
): TraverseValidationResult {
  const [tx, ty] = targetCoords;
  const [cx, cy] = rover.currentCoords;

  // 1. Rover Mobility Status Checks
  if (rover.mobilityState === 'STOWED') {
    return createFailedResult('Rover is STOWED aboard lander; deployment required before traverse.');
  }
  if (rover.mobilityState === 'DISABLED' || rover.mobilityState === 'LOST') {
    return createFailedResult(`Rover mobility is ${rover.mobilityState}. Cannot initiate movement.`);
  }
  if (rover.mobilityState === 'MOVING') {
    return createFailedResult('Rover is currently in motion. Await traverse completion.');
  }
  if (rover.mobilityHealthPercent < ROVER_MIN_MOBILITY_HEALTH_PERCENT) {
    return createFailedResult(
      `Mobility health (${rover.mobilityHealthPercent.toFixed(1)}%) is below critical threshold (${ROVER_MIN_MOBILITY_HEALTH_PERCENT}%). Drive motors interlocked.`
    );
  }

  // 2. Target Coordinate Bounds Checks
  const targetCell = getTerrainCell(grid, tx, ty);
  if (!targetCell) {
    return createFailedResult(`Target coordinates [${tx}, ${ty}] are out of survey bounds.`);
  }

  // 3. Adjacency / Step Distance Checks (Single step: orthogonal or diagonal)
  const dx = Math.abs(tx - cx);
  const dy = Math.abs(ty - cy);
  if (dx === 0 && dy === 0) {
    return createFailedResult('Target coordinates are identical to current rover position.');
  }
  if (dx > 1 || dy > 1) {
    return createFailedResult(
      `Target [${tx}, ${ty}] is not adjacent to current position [${cx}, ${cy}]. Multi-step pathing requires step-by-step traversal.`
    );
  }

  // 4. Physical Obstacle Checks
  if (targetCell.hasObstacle) {
    return createFailedResult(
      `Path blocked by impassable obstacle: ${targetCell.obstacleType ?? 'Terrain Barrier'} at [${tx}, ${ty}].`
    );
  }

  // 5. Slope & Traction Limits
  if (targetCell.slopeDeg > ROVER_MAX_TRAVERSABLE_SLOPE_DEG) {
    return createFailedResult(
      `Slope (${targetCell.slopeDeg.toFixed(1)}°) exceeds maximum negotiable incline (${ROVER_MAX_TRAVERSABLE_SLOPE_DEG}°). High risk of wheel slippage and rollover.`
    );
  }

  // 6. Surface Roughness & Mechanical Stress
  if (targetCell.roughness > ROVER_MAX_TRAVERSABLE_ROUGHNESS) {
    return createFailedResult(
      `Chaos terrain roughness (${targetCell.roughness.toFixed(2)}) exceeds rover clearance limit (${ROVER_MAX_TRAVERSABLE_ROUGHNESS}). Chassis high-centering hazard.`
    );
  }

  // 7. Distance & Kinematic Calculations
  const isDiagonal = dx === 1 && dy === 1;
  const distanceMetres = isDiagonal
    ? TERRAIN_CELL_SIZE_METRES * Math.SQRT2
    : TERRAIN_CELL_SIZE_METRES;

  const durationSeconds = Math.round((distanceMetres / ROVER_NOMINAL_SPEED_MPS) * targetCell.traversalDifficulty);

  // Power & Energy Calculation:
  // Energy = Traverse_Power * duration * difficulty_factor
  const energyCostJoules = Math.round(
    ROVER_POWER_DEMANDS_WATTS.TRAVERSE * durationSeconds * targetCell.traversalDifficulty
  );

  // 8. Battery Reserve Availability Check
  if (rover.batteryEnergyJoules < energyCostJoules) {
    const energyShortfallWh = ((energyCostJoules - rover.batteryEnergyJoules) / 3600).toFixed(1);
    return createFailedResult(
      `Insufficient battery energy: required ${(energyCostJoules / 3600).toFixed(1)} Wh, available ${(rover.batteryEnergyJoules / 3600).toFixed(1)} Wh (deficit: ${energyShortfallWh} Wh). Wait for RTG recharge.`
    );
  }

  return {
    isFeasible: true,
    distanceMetres: Math.round(distanceMetres * 10) / 10,
    durationSeconds,
    energyCostJoules,
    pathCoords: [[cx, cy], [tx, ty]],
    hazardFactor: targetCell.hazardLevel,
  };
}

function createFailedResult(reason: string): TraverseValidationResult {
  return {
    isFeasible: false,
    reason,
    distanceMetres: 0,
    durationSeconds: 0,
    energyCostJoules: 0,
    pathCoords: [],
    hazardFactor: 0,
  };
}
