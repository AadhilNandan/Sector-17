/**
 * SECTOR 17 — Tutorial Module 04: Mission Flight Operations
 * Phase 9.1.2 Production Implementation
 *
 * Page: /operations
 * Teaches: Real-time spacecraft telemetry, MET clock stepping/warp, DSN ground link
 * re-acquisition, science data packet processing, probe deployment, and
 * authoritative mission completion evaluation leading to debrief.
 */

import type { TutorialStep, TutorialModule } from '../../types';

export const MODULE_04_METADATA: TutorialModule = {
  id: 'MODULE_04_OPERATIONS',
  title: 'Mission Flight Operations',
  subtitle: 'AETHON Flight Control & Science Execution',
  description: 'Manage live spacecraft systems, recover DSN radio links, process radar observations, and execute probe deployment.',
  route: '/operations',
  order: 4,
  stepIds: [
    'tut-04-operations-overview',
    'tut-04-time-controls',
    'tut-04-communications-dsn',
    'tut-04-science-processing',
    'tut-04-deploy-lander',
    'tut-04-finalize-expedition',
  ],
};

export const MODULE_04_STEPS: readonly TutorialStep[] = [
  {
    id: 'tut-04-operations-overview',
    moduleId: 'MODULE_04_OPERATIONS',
    order: 1,
    route: '/operations',
    title: 'The Flight Operations Workstation',
    instruction: 'Inspect the live flight telemetry and operational workspace.',
    detailedExplanation:
      'The Mission Operations console represents AETHON’s active flight control center. The left panel streams Power & Thermal telemetry (bus voltage, battery temps, solar output); the center viewport renders AETHON in Europa orbit; the right panel streams Propulsion & Navigation telemetry (apoapsis, periapsis, velocity, RCS fuel); and the bottom panel houses the MET clock, event log, and flight control modals.',
    technicalContext:
      'Attitude control maintains the dorsal High-Gain Antenna oriented toward Earth while steering solar panels toward the Sun and forward radar antennas toward Europa.',
    targetId: 'viewport-operations-spacecraft',
    expectedAction: 'READ',
    verification: {
      type: 'USER_ACKNOWLEDGEMENT',
    },
    successMessage: 'Flight operations workstation verified. Telemetry streams nominal.',
    handbookArticleId: 'art-09-flight-operations',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-04-time-controls',
    moduleId: 'MODULE_04_OPERATIONS',
    order: 2,
    route: '/operations',
    title: 'Mission Elapsed Time & Time Acceleration',
    instruction: 'Advance the simulation clock using the [+1h] or [+24h] buttons or warp multipliers.',
    detailedExplanation:
      'Deep-space missions operate across extended timelines. The MET clock in the lower left displays Days:Hours:Minutes:Seconds. Use the Pause/Resume toggle, the step buttons (+1h, +24h), or the warp rate buttons (1x, 5x, 10x, 50x) to advance the mission deterministically.',
    targetId: 'controls-met-clock',
    expectedAction: 'STEP_TIME',
    verification: {
      type: 'DOM_INTERACTION_SIGNAL',
      signalKey: 'time_step_executed',
    },
    successMessage: 'Simulation clock stepped. Subsystem states advanced deterministically.',
    recoveryGuidance: 'Click the [+1h] or [+24h] button in the lower left Mission Elapsed Time section.',
    handbookArticleId: 'art-09-flight-operations',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
  {
    id: 'tut-04-communications-dsn',
    moduleId: 'MODULE_04_OPERATIONS',
    order: 3,
    route: '/operations',
    title: 'Deep Space Network (DSN) Communications',
    instruction: 'Open the [ COMMUNICATIONS ] console and check DSN carrier link status.',
    detailedExplanation:
      'Deep space telemetry transmits via NASA’s Deep Space Network (DSN 70m antennas at Goldstone, Madrid, and Canberra). Periodic planetary occultations and handoffs cause temporary link drops. Clicking [ RECOVER LINK ] re-establishes HGA carrier lock to permit telemetry downlink.',
    technicalContext:
      'At 5.2 AU, round-trip radio signals take approximately 70–90 minutes. Telemetry packets must be held in onboard solid-state storage (SSDR) until an active communication window opens.',
    targetId: 'btn-open-communications',
    expectedAction: 'CLICK',
    verification: {
      type: 'DOM_INTERACTION_SIGNAL',
      signalKey: 'comms_modal_inspected',
    },
    successMessage: 'Communications subsystem verified. DSN Canberra 70M carrier active.',
    recoveryGuidance: 'Click the [ COMMUNICATIONS ] button in the lower right Operations Control panel.',
    handbookArticleId: 'art-10-dsn-communications',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
  {
    id: 'tut-04-science-processing',
    moduleId: 'MODULE_04_OPERATIONS',
    order: 4,
    route: '/operations',
    title: 'Process Scientific Observations',
    instruction: 'Click [ SCIENCE PROCESSING ] and trigger [ PROCESS OBSERVATION BATCH ].',
    detailedExplanation:
      'Data Lifecycle: Raw sensor packets (Level 0) acquired by REASON and MASPEX are stored in onboard memory. Clicking Process Observation Batch ingests, calibrates, and derives Level 2 science products (depth profiles and chemical mass spectra) ready for transmission to Earth.',
    technicalContext:
      'Data Acquired (stored locally in SSDR) does not equal Data Returned (downlinked to Earth). Only processed and downlinked data produces confirmed discoveries in the final Mission Debrief.',
    targetId: 'btn-open-science',
    expectedAction: 'CLICK',
    verification: {
      type: 'EVENT_AFTER_BASELINE',
      eventType: 'SCIENCE_OBSERVATION_PROCESSED',
    },
    successMessage: 'Science observation batch processed. Radar sounding and mass spectra derived.',
    recoveryGuidance: 'Click [ SCIENCE PROCESSING ] in the bottom panel, then click [ PROCESS OBSERVATION BATCH ].',
    handbookArticleId: 'art-11-reason-radar',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
  {
    id: 'tut-04-deploy-lander',
    moduleId: 'MODULE_04_OPERATIONS',
    order: 5,
    route: '/operations',
    title: 'Deploy Surface Probe PROMETHEUS-IV',
    instruction: 'Click [ GROUND ! DROP ] in the upper header to release the subsurface survey probe.',
    detailedExplanation:
      'Releasing the PROMETHEUS-IV subsurface probe initiates its terminal powered descent toward Europa’s fractured chaos terrain. This triggers an operational event logged in the flight computer without requiring navigation away from flight control.',
    targetId: 'btn-header-drop-lander',
    expectedAction: 'CLICK',
    verification: {
      type: 'EVENT_AFTER_BASELINE',
      eventType: 'LANDER_DEPLOYMENT_CONFIRMED',
    },
    successMessage: 'Probe released! PROMETHEUS-IV terminal descent sequence confirmed nominal.',
    recoveryGuidance: 'Click the amber [ GROUND [! DROP] ] button in the top mission status bar.',
    handbookArticleId: 'art-13-probe-deployment',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
  {
    id: 'tut-04-finalize-expedition',
    moduleId: 'MODULE_04_OPERATIONS',
    order: 6,
    route: '/operations',
    title: 'Conclude Expedition & Open Debrief',
    instruction: 'Click [ FINALIZE EXPEDITION & DEBRIEF ] to review mission evaluation and proceed to debrief.',
    detailedExplanation:
      'The Mission Completion Evaluator scores five operational criteria: spacecraft structural health, Jovian orbit achievement, power/thermal adequacy, science data acquisition, and probe deployment. Confirming debrief transitions the campaign to MISSION_DEBRIEF and routes to /debrief.',
    targetId: 'btn-finalize-expedition',
    expectedAction: 'CLICK',
    verification: {
      type: 'ROUTE_MATCH',
      expectedRoute: '/debrief',
    },
    successMessage: 'Mission operations concluded. Opening final archival report.',
    recoveryGuidance: 'Click [ FINALIZE EXPEDITION & DEBRIEF ] in the lower right, then confirm in the modal.',
    handbookArticleId: 'art-14-mission-evaluation',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
];
