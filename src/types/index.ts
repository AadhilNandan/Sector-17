/**
 * SECTOR 17: THE LAST EXPEDITION
 * Shared TypeScript Definitions
 */

export type MissionStatus = 'nominal' | 'standby' | 'warning' | 'critical' | 'offline';

export type AccentVariant = 'cyan' | 'amber' | 'red' | 'graphite';

export interface NavRoute {
  id: string;
  path: string;
  label: string;
  shortLabel?: string;
  iconName: 'Compass' | 'Radio' | 'Cpu' | 'ShieldAlert' | 'Layers' | 'Terminal' | 'Crosshair';
  badge?: string;
}

export interface TelemetryMetric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  status?: MissionStatus;
  change?: string;
}

export interface VesselStatus {
  id: string;
  name: string;
  callsign: string;
  class: string;
  status: MissionStatus;
  coordinates: [number, number, number];
  hullIntegrity: number; // percentage
  fuelReserve: number; // percentage
}

