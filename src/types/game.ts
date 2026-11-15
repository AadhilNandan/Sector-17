/**
 * SECTOR 17 — THE LAST EXPEDITION
 * Core Game Data Types & Schema
 */

export type ScreenId =
  | 'menu'
  | 'missions'
  | 'workshop'
  | 'trajectory'
  | 'operations'
  | 'surface'
  | 'anomaly'
  | 'debrief';

export interface Mission {
  id: string;
  title: string;
  target: string;
  targetType: string;
  description: string;
  objectives: string[];
  difficulty: number; // 1 to 5
  estimatedDuration: string; // e.g. "42 Days"
  distance: string;
  locked: boolean;
}

export type ComponentCategory =
  | 'structure'
  | 'propulsion'
  | 'power'
  | 'instruments'
  | 'communication'
  | 'thermal';

export interface SpacecraftPart {
  id: string;
  category: ComponentCategory;
  name: string;
  description: string;
  massKg: number;
  powerKw: number; // positive = consumes, negative = generates
  costBudgetPercent: number;
  specs: Record<string, string | number>;
}

export interface LaunchVehicle {
  id: string;
  name: string;
  maxPayloadKg: number;
  costPercent: number;
  description: string;
  iconName: string;
}

export interface SpacecraftConfig {
  name: string;
  parts: Record<ComponentCategory, SpacecraftPart>;
  launchVehicle: LaunchVehicle;
}

export interface TrajectoryParameters {
  deltaV: number; // km/s
  flightTimeDays: number;
  fuelUsePercent: number;
  departureBurnTime: string;
  orbitalInsertionDate: string;
  targetBearing: string;
}

export interface SystemStatus {
  powerPercent: number;
  thermalPercent: number;
  commPercent: number;
  fuelPercent: number;
}

export type AnomalyDecision = 'analyze' | 'sample' | 'withdraw';

export interface DebriefScore {
  finalScore: number;
  maxScore: number;
  objectiveCompletion: number; // percentage
  resourceEfficiency: number; // percentage
  riskHandling: number; // percentage
  scientificValue: number; // percentage
  discoveries: string[];
  decisionSummary: string;
}

