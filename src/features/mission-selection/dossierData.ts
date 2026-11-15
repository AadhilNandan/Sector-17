/**
 * SECTOR 17 — Expedition Archive Data
 * Definitions for historical fictional expeditions (Expedition-III, Expedition-IV)
 * and the active campaign expedition (Expedition-V).
 */

export type SegmentStatus = 'COMPLETED' | 'ACTIVE' | 'PENDING' | 'FAILED' | 'NOT_APPLICABLE';

export interface MissionSegment {
  id: 'launch' | 'space' | 'ground' | 'user';
  label: 'LAUNCH' | 'SPACE' | 'GROUND' | 'USER';
  status: SegmentStatus;
  statusText: string;
}

export interface ExpeditionDossier {
  id: string;
  title: string;
  destination: string;
  dateRange: string;
  fictionalTarget?: string;
  objectiveSummary: string;
  debriefField?: string;
  handwrittenNote?: {
    text: string;
    curveDirection: 'down-left' | 'up-right';
  };
  outcomeStamp: {
    label: string;
    variant: 'completed' | 'partial-failure' | 'active';
    rotationDeg: number;
  };
  sealType: 'ganymede' | 'callisto' | 'europa';
  paperVariant: 'blue-grey' | 'aged-parchment' | 'clean-ivory';
  isPlayable: boolean;
  vesselName: string;
  segments: MissionSegment[];
}

export const HISTORICAL_DOSSIERS: Record<string, ExpeditionDossier> = {
  'expedition-3': {
    id: 'expedition-3',
    title: 'EXPEDITION-III',
    destination: 'GANYMEDE',
    dateRange: '04.12.2031 - 08.19.2032',
    fictionalTarget: 'GANYMEDE SURFACE & SUBSURFACE SURVEY',
    objectiveSummary:
      'Establish orbit at Ganymede, deploy rover PROMETHEUS-IV, and survey local surface including unverified relic hypothesis.',
    outcomeStamp: {
      label: 'COMPLETED',
      variant: 'completed',
      rotationDeg: -2.5,
    },
    sealType: 'ganymede',
    paperVariant: 'blue-grey',
    isPlayable: false,
    vesselName: 'HERMES-II',
    segments: [
      { id: 'launch', label: 'LAUNCH', status: 'COMPLETED', statusText: '✔' },
      { id: 'space', label: 'SPACE', status: 'COMPLETED', statusText: '✔' },
      { id: 'ground', label: 'GROUND', status: 'COMPLETED', statusText: '✔' },
      { id: 'user', label: 'USER', status: 'COMPLETED', statusText: '✔' },
    ],
  },
  'expedition-4': {
    id: 'expedition-4',
    title: 'EXPEDITION-IV',
    destination: 'CALLISTO',
    dateRange: '11.02.2033 - 05.14.2034',
    fictionalTarget: 'CALLISTO SURFACE & SERVICE SURVEY',
    objectiveSummary:
      'Orbit mapping to transverse orbit capitation and anomalous objective sineleration; descent vehicle lost during terminal descent.',
    handwrittenNote: {
      text: 'Telemetry lost at 80m',
      curveDirection: 'down-left',
    },
    outcomeStamp: {
      label: 'PARTIAL FAILURE',
      variant: 'partial-failure',
      rotationDeg: 3.5,
    },
    sealType: 'callisto',
    paperVariant: 'aged-parchment',
    isPlayable: false,
    vesselName: 'ORION-IV',
    segments: [
      { id: 'launch', label: 'LAUNCH', status: 'COMPLETED', statusText: '[OK]' },
      { id: 'space', label: 'SPACE', status: 'COMPLETED', statusText: '[OK]' },
      { id: 'ground', label: 'GROUND', status: 'FAILED', statusText: '[FAILED]' },
      { id: 'user', label: 'USER', status: 'NOT_APPLICABLE', statusText: '[N/A]' },
    ],
  },
  'expedition-5': {
    id: 'expedition-5',
    title: 'EXPEDITION-V',
    destination: 'EUROPA SURVEY',
    dateRange: '09.08.2035 - PRESENT',
    fictionalTarget: 'EUROPA OCEAN & ICE SHELL RECONNAISSANCE',
    objectiveSummary:
      'Establish orbit at Europa, deploy rover PROMETHEUS-IV, and survey local anomalies (including unverified relic hypothesis).',
    debriefField: 'ACTIVE CAMPAIGN DIRECTIVE — PENDING TELEMETRY RECORD',
    outcomeStamp: {
      label: 'ACTIVE',
      variant: 'active',
      rotationDeg: -1.8,
    },
    sealType: 'europa',
    paperVariant: 'clean-ivory',
    isPlayable: true,
    vesselName: 'AETHON',
    segments: [
      { id: 'launch', label: 'LAUNCH', status: 'PENDING', statusText: '[PENDING]' },
      { id: 'space', label: 'SPACE', status: 'PENDING', statusText: '[PENDING]' },
      { id: 'ground', label: 'GROUND', status: 'PENDING', statusText: '[PENDING]' },
      { id: 'user', label: 'USER', status: 'PENDING', statusText: '[PENDING]' },
    ],
  },
};
